import json
import unittest
from unittest.mock import patch

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.services import agent_service
from app.services.agent_service import (
    _build_enriched_from_messages,
    run_agent_for_finding,
    should_use_agent,
)


def build_cve_finding():
    return {
        "id": "FND-001",
        "ruleId": "CVE-2024-21626",
        "source": "trivy",
        "severity": "HIGH",
        "scanType": "PROJECT_FILE",
        "file": "Dockerfile",
        "line": 12,
        "title": "runc CVE-2024-21626 container breakout",
        "maskedEvidence": "runc 1.1.7",
    }


def build_non_cve_finding():
    return {
        "id": "FND-002",
        "ruleId": "DOCKER_RUN_AS_ROOT",
        "source": "custom-rule",
        "severity": "MEDIUM",
        "scanType": "PROJECT_FILE",
        "file": "Dockerfile",
        "line": 5,
        "title": "Dockerfile runs as root",
        "maskedEvidence": "USER root",
    }


class ShouldUseAgentTest(unittest.TestCase):
    def test_cve_finding_with_agent_enabled(self):
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertTrue(should_use_agent(build_cve_finding()))

    def test_cve_finding_with_agent_disabled(self):
        with patch.object(agent_service, "AGENT_ENABLED", False):
            self.assertFalse(should_use_agent(build_cve_finding()))

    def test_non_cve_finding_skipped_even_when_enabled(self):
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertFalse(should_use_agent(build_non_cve_finding()))

    def test_cve_in_title_only(self):
        finding = build_non_cve_finding()
        finding["title"] = "Discovered CVE-2023-9999 in image"
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertTrue(should_use_agent(finding))


class BuildEnrichedFromMessagesTest(unittest.TestCase):
    def test_empty_messages(self):
        enriched = _build_enriched_from_messages([])
        self.assertEqual(enriched["tool_calls"], [])
        self.assertEqual(enriched["agent_summary"], "")
        self.assertNotIn("cve_info", enriched)

    def test_extracts_cve_info_from_search_cve_tool(self):
        cve_payload = {
            "available": True,
            "cve_id": "CVE-2024-21626",
            "cvss_score": 8.6,
            "severity": "HIGH",
        }
        messages = [
            HumanMessage(content="Research CVE-2024-21626"),
            AIMessage(
                content="",
                tool_calls=[{"id": "call_1", "name": "search_cve", "args": {"cve_id": "CVE-2024-21626"}}],
            ),
            ToolMessage(content=json.dumps(cve_payload), tool_call_id="call_1", name="search_cve"),
            AIMessage(content="CVSS 8.6, HIGH 등급입니다."),
        ]
        enriched = _build_enriched_from_messages(messages)
        self.assertEqual(len(enriched["tool_calls"]), 1)
        self.assertEqual(enriched["tool_calls"][0]["tool"], "search_cve")
        self.assertIn("cve_info", enriched)
        self.assertEqual(enriched["cve_info"]["cvss_score"], 8.6)
        self.assertEqual(enriched["agent_summary"], "CVSS 8.6, HIGH 등급입니다.")

    def test_ignores_unavailable_cve_result(self):
        cve_payload = {"available": False, "cve_id": "CVE-2099-9999", "error": "not found"}
        messages = [
            AIMessage(
                content="",
                tool_calls=[{"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-2099-9999"}}],
            ),
            ToolMessage(content=json.dumps(cve_payload), tool_call_id="c1", name="search_cve"),
            AIMessage(content="No CVE found"),
        ]
        enriched = _build_enriched_from_messages(messages)
        self.assertNotIn("cve_info", enriched)
        self.assertEqual(len(enriched["tool_calls"]), 1)  # call 자체는 기록됨

    def test_aggregates_multiple_tools(self):
        cve = json.dumps({"available": True, "cve_id": "CVE-2024-1", "cvss_score": 9.0})
        code = json.dumps({"available": True, "target": "Dockerfile", "snippet": "USER root"})
        web = json.dumps([{"title": "T", "url": "https://x", "snippet": "s"}])
        messages = [
            AIMessage(
                content="",
                tool_calls=[
                    {"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-2024-1"}},
                    {"id": "c2", "name": "analyze_code_context", "args": {"target": "Dockerfile", "line": 1}},
                    {"id": "c3", "name": "search_web", "args": {"query": "best practice"}},
                ],
            ),
            ToolMessage(content=cve, tool_call_id="c1", name="search_cve"),
            ToolMessage(content=code, tool_call_id="c2", name="analyze_code_context"),
            ToolMessage(content=web, tool_call_id="c3", name="search_web"),
            AIMessage(content="모든 도구 호출 완료"),
        ]
        enriched = _build_enriched_from_messages(messages)
        self.assertEqual(len(enriched["tool_calls"]), 3)
        self.assertIn("cve_info", enriched)
        self.assertIn("code_context", enriched)
        self.assertEqual(len(enriched["web_refs"]), 1)

    def test_handles_anthropic_style_list_content(self):
        messages = [
            AIMessage(content=[{"type": "text", "text": "최종 요약입니다."}]),
        ]
        enriched = _build_enriched_from_messages(messages)
        self.assertEqual(enriched["agent_summary"], "최종 요약입니다.")


class RunAgentForFindingTest(unittest.TestCase):
    def test_disabled_returns_empty(self):
        with patch.object(agent_service, "AGENT_ENABLED", False):
            self.assertEqual(run_agent_for_finding(build_cve_finding()), {})

    def test_agent_exception_returns_empty_fail_open(self):
        class FakeAgent:
            def invoke(self, *_args, **_kwargs):
                raise RuntimeError("boom")

        with patch.object(agent_service, "AGENT_ENABLED", True), patch(
            "app.chains.agent_chain.build_agent", return_value=FakeAgent()
        ):
            result = run_agent_for_finding(build_cve_finding())
        self.assertEqual(result, {})

    def test_successful_run_builds_enriched(self):
        cve_payload = {
            "available": True,
            "cve_id": "CVE-2024-21626",
            "cvss_score": 8.6,
            "severity": "HIGH",
        }
        fake_messages = [
            AIMessage(
                content="",
                tool_calls=[{"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-2024-21626"}}],
            ),
            ToolMessage(content=json.dumps(cve_payload), tool_call_id="c1", name="search_cve"),
            AIMessage(content="CVSS 8.6 HIGH"),
        ]

        class FakeAgent:
            def invoke(self, *_args, **_kwargs):
                return {"messages": fake_messages}

        with patch.object(agent_service, "AGENT_ENABLED", True), patch(
            "app.chains.agent_chain.build_agent", return_value=FakeAgent()
        ):
            result = run_agent_for_finding(build_cve_finding())

        self.assertEqual(len(result["tool_calls"]), 1)
        self.assertEqual(result["cve_info"]["cvss_score"], 8.6)
        self.assertEqual(result["agent_summary"], "CVSS 8.6 HIGH")


if __name__ == "__main__":
    unittest.main()
