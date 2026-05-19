import unittest
from unittest.mock import patch

from app.services import agent_service, analysis_service


GOOD_EXPLAIN = {
    "explanation": {
        "summary": "요약",
        "whyRisky": "위험",
        "abuseScenario": "악용",
        "expectedImpact": "영향",
        "severityInterpretation": "해석",
    },
    "impact": "비유 설명",
}


GOOD_FIX = {
    "summary": "fix 요약",
    "priority": "high",
    "recommendedActions": ["조치1", "조치2"],
    "codeGuidance": "가이드",
    "verification": "검증 명령",
    "cautions": [],
}


def build_cve_finding():
    return {
        "id": "FND-AGENT-INT-001",
        "ruleId": "CVE-2024-21626",
        "source": "trivy",
        "severity": "HIGH",
        "scanType": "PROJECT_FILE",
        "file": "Dockerfile",
        "line": 1,
        "title": "runc CVE-2024-21626 container breakout",
        "maskedEvidence": "runc 1.1.7",
    }


def build_non_cve_finding():
    return {
        "id": "FND-AGENT-INT-002",
        "ruleId": "DOCKER_RUN_AS_ROOT",
        "source": "custom-rule",
        "severity": "MEDIUM",
        "scanType": "PROJECT_FILE",
        "file": "Dockerfile",
        "line": 5,
        "title": "Dockerfile runs as root",
        "maskedEvidence": "USER root",
    }


SAMPLE_SCAN_RESULT = {
    "artifacts": [
        {"target": "Dockerfile", "content": "FROM python\nUSER root\n", "hash": "sha256:x", "type": "file"}
    ]
}


class AgentIntegrationTest(unittest.TestCase):
    def test_agent_disabled_does_not_enrich_explain_or_fix(self):
        captured = {}

        def fake_explain(finding, enriched_context=None):
            captured["explain_enriched"] = enriched_context
            return GOOD_EXPLAIN

        def fake_fix(finding, enriched_context=None):
            captured["fix_enriched"] = enriched_context
            return GOOD_FIX

        with patch.object(agent_service, "AGENT_ENABLED", False), patch.object(
            analysis_service, "generate_finding_explanation", side_effect=fake_explain
        ), patch.object(
            analysis_service, "generate_finding_fix", side_effect=fake_fix
        ):
            analysis_service.analyze_finding(
                build_cve_finding(), scan_result=SAMPLE_SCAN_RESULT
            )

        self.assertIsNone(captured["explain_enriched"])
        self.assertIsNone(captured["fix_enriched"])

    def test_non_cve_finding_skipped_even_when_agent_enabled(self):
        captured = {}

        def fake_explain(finding, enriched_context=None):
            captured["enriched"] = enriched_context
            return GOOD_EXPLAIN

        with patch.object(agent_service, "AGENT_ENABLED", True), patch.object(
            analysis_service, "generate_finding_explanation", side_effect=fake_explain
        ), patch.object(
            analysis_service, "generate_finding_fix", return_value=GOOD_FIX
        ):
            analysis_service.analyze_finding(
                build_non_cve_finding(), scan_result=SAMPLE_SCAN_RESULT
            )

        self.assertIsNone(captured["enriched"])

    def test_cve_finding_with_agent_enabled_passes_enriched_to_chains(self):
        fake_enriched = {
            "tool_calls": [{"tool": "search_cve", "args": {}, "result": {}}],
            "cve_info": {
                "available": True,
                "cve_id": "CVE-2024-21626",
                "cvss_score": 8.6,
                "severity": "HIGH",
            },
            "agent_summary": "CVSS 8.6 HIGH",
        }
        captured = {}

        def fake_explain(finding, enriched_context=None):
            captured["explain_enriched"] = enriched_context
            return GOOD_EXPLAIN

        def fake_fix(finding, enriched_context=None):
            captured["fix_enriched"] = enriched_context
            return GOOD_FIX

        with patch.object(agent_service, "AGENT_ENABLED", True), patch.object(
            analysis_service, "run_agent_for_finding", return_value=fake_enriched
        ), patch.object(
            analysis_service, "generate_finding_explanation", side_effect=fake_explain
        ), patch.object(
            analysis_service, "generate_finding_fix", side_effect=fake_fix
        ):
            result = analysis_service.analyze_finding(
                build_cve_finding(), scan_result=SAMPLE_SCAN_RESULT
            )

        self.assertIs(captured["explain_enriched"], fake_enriched)
        self.assertIs(captured["fix_enriched"], fake_enriched)
        self.assertEqual(result["findingId"], "FND-AGENT-INT-001")

    def test_agent_failure_falls_back_to_no_enrichment(self):
        captured = {}

        def fake_explain(finding, enriched_context=None):
            captured["enriched"] = enriched_context
            return GOOD_EXPLAIN

        # run_agent_for_finding가 빈 dict 반환 (내부 예외 시 fail-open)
        with patch.object(agent_service, "AGENT_ENABLED", True), patch.object(
            analysis_service, "run_agent_for_finding", return_value={}
        ), patch.object(
            analysis_service, "generate_finding_explanation", side_effect=fake_explain
        ), patch.object(
            analysis_service, "generate_finding_fix", return_value=GOOD_FIX
        ):
            analysis_service.analyze_finding(
                build_cve_finding(), scan_result=SAMPLE_SCAN_RESULT
            )

        # 빈 dict → format_enriched_context_for_prompt가 빈 string → prompt 동작 동일
        # explain/fix는 빈 dict를 그대로 받지만 prompt 영향 없음
        self.assertEqual(captured["enriched"], {})


if __name__ == "__main__":
    unittest.main()
