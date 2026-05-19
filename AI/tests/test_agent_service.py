import json
import unittest
from unittest.mock import patch

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.services import agent_service
from app.services.agent_service import (
    _build_enriched_from_messages,
    _build_reasoning_steps_from_messages,
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

    def test_non_cve_high_severity_routed_to_agent(self):
        finding = build_non_cve_finding()
        finding["severity"] = "HIGH"
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertTrue(should_use_agent(finding))

    def test_non_cve_critical_severity_routed_to_agent(self):
        finding = build_non_cve_finding()
        finding["severity"] = "CRITICAL"
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertTrue(should_use_agent(finding))

    def test_non_cve_low_severity_skipped(self):
        finding = build_non_cve_finding()
        finding["severity"] = "LOW"
        with patch.object(agent_service, "AGENT_ENABLED", True):
            self.assertFalse(should_use_agent(finding))

    def test_non_cve_high_severity_with_agent_disabled_skipped(self):
        finding = build_non_cve_finding()
        finding["severity"] = "HIGH"
        with patch.object(agent_service, "AGENT_ENABLED", False):
            self.assertFalse(should_use_agent(finding))

    def test_severity_match_is_case_insensitive(self):
        finding = build_non_cve_finding()
        finding["severity"] = "high"
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


class BuildReasoningStepsTest(unittest.TestCase):
    def test_empty_messages_returns_empty_list(self):
        self.assertEqual(_build_reasoning_steps_from_messages([]), [])

    def test_thought_action_observation_single_cycle(self):
        cve_payload = {"available": True, "cvss_score": 8.6}
        messages = [
            HumanMessage(content="Research CVE-2024-21626"),
            AIMessage(
                content="CVE 정보를 NVD에서 조회해야 한다",
                tool_calls=[
                    {"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-2024-21626"}}
                ],
            ),
            ToolMessage(
                content=json.dumps(cve_payload), tool_call_id="c1", name="search_cve"
            ),
            AIMessage(content="CVSS 8.6으로 매우 높은 심각도입니다."),
        ]
        steps = _build_reasoning_steps_from_messages(messages)
        self.assertEqual(len(steps), 2)
        self.assertEqual(steps[0]["step"], 1)
        self.assertEqual(steps[0]["thought"], "CVE 정보를 NVD에서 조회해야 한다")
        self.assertEqual(steps[0]["action"], "search_cve")
        self.assertEqual(steps[0]["actionInput"], {"cve_id": "CVE-2024-21626"})
        self.assertEqual(steps[0]["observation"], cve_payload)
        self.assertEqual(steps[1]["step"], 2)
        self.assertTrue(steps[1].get("final"))
        self.assertEqual(steps[1]["thought"], "CVSS 8.6으로 매우 높은 심각도입니다.")

    def test_multiple_tool_calls_in_one_message(self):
        messages = [
            AIMessage(
                content="여러 정보를 동시에 모으겠습니다.",
                tool_calls=[
                    {"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-1"}},
                    {"id": "c2", "name": "search_web", "args": {"query": "x"}},
                ],
            ),
            ToolMessage(content=json.dumps({"available": True}), tool_call_id="c1", name="search_cve"),
            ToolMessage(content=json.dumps([{"title": "t"}]), tool_call_id="c2", name="search_web"),
            AIMessage(content="완료"),
        ]
        steps = _build_reasoning_steps_from_messages(messages)
        # 2 tool calls + 1 final = 3 steps
        self.assertEqual(len(steps), 3)
        # 첫 step에만 thought, 두번째는 None (중복 방지)
        self.assertEqual(steps[0]["thought"], "여러 정보를 동시에 모으겠습니다.")
        self.assertIsNone(steps[1]["thought"])
        self.assertEqual(steps[0]["action"], "search_cve")
        self.assertEqual(steps[1]["action"], "search_web")
        # 각 step의 observation이 올바르게 매칭됐는지
        self.assertEqual(steps[0]["observation"], {"available": True})
        self.assertEqual(steps[1]["observation"], [{"title": "t"}])
        # 마지막은 final
        self.assertTrue(steps[2].get("final"))

    def test_tool_message_without_id_falls_back_to_last_step(self):
        messages = [
            AIMessage(
                content="조회",
                tool_calls=[{"id": "c1", "name": "search_cve", "args": {}}],
            ),
            ToolMessage(content="some result", tool_call_id="", name="search_cve"),
        ]
        steps = _build_reasoning_steps_from_messages(messages)
        self.assertEqual(len(steps), 1)
        self.assertEqual(steps[0]["observation"], "some result")

    def test_anthropic_list_content_thought_extracted(self):
        messages = [
            AIMessage(
                content=[{"type": "text", "text": "한국어 추론"}],
                tool_calls=[{"id": "c1", "name": "search_web", "args": {"query": "x"}}],
            ),
        ]
        steps = _build_reasoning_steps_from_messages(messages)
        self.assertEqual(steps[0]["thought"], "한국어 추론")


class EnrichedIncludesReasoningStepsTest(unittest.TestCase):
    def test_enriched_contains_reasoning_steps_key(self):
        messages = [
            AIMessage(
                content="thought",
                tool_calls=[{"id": "c1", "name": "search_cve", "args": {"cve_id": "CVE-X"}}],
            ),
            ToolMessage(
                content=json.dumps({"available": False}), tool_call_id="c1", name="search_cve"
            ),
            AIMessage(content="끝"),
        ]
        enriched = _build_enriched_from_messages(messages)
        self.assertIn("reasoning_steps", enriched)
        self.assertEqual(len(enriched["reasoning_steps"]), 2)


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
