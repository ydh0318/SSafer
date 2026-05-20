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
            "reasoning_steps": [
                {
                    "step": 1,
                    "thought": "CVE 조회",
                    "action": "search_cve",
                    "actionInput": {"cve_id": "CVE-2024-21626"},
                    "observation": {"available": True},
                },
                {"step": 2, "thought": "최종 정리", "final": True},
            ],
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
        # reasoningSteps가 결과 JSON에 첨부됐는지
        self.assertIn("reasoningSteps", result)
        self.assertEqual(len(result["reasoningSteps"]), 2)
        self.assertEqual(result["reasoningSteps"][0]["action"], "search_cve")

    def test_non_agent_path_does_not_include_reasoning_steps(self):
        with patch.object(agent_service, "AGENT_ENABLED", False), patch.object(
            analysis_service, "generate_finding_explanation", return_value=GOOD_EXPLAIN
        ), patch.object(
            analysis_service, "generate_finding_fix", return_value=GOOD_FIX
        ):
            result = analysis_service.analyze_finding(
                build_cve_finding(), scan_result=SAMPLE_SCAN_RESULT
            )
        self.assertNotIn("reasoningSteps", result)

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


class AnalyzeFindingsRoutingTest(unittest.TestCase):
    """다건 분석에서 agent 대상은 개별 경로, 나머지는 batch 경로로 분리되는지 검증."""

    def _build_findings(self):
        cve = build_cve_finding()  # HIGH + CVE ruleId -> agent
        med1 = build_non_cve_finding()  # MEDIUM non-cve -> batch
        med2 = {**build_non_cve_finding(), "id": "FND-AGENT-INT-003"}
        low = {
            **build_non_cve_finding(),
            "id": "FND-AGENT-INT-004",
            "severity": "LOW",
        }
        return [cve, med1, med2, low]

    def test_high_cve_uses_agent_others_use_batch(self):
        captured = {"agent_ids": [], "batch_explain_ids": None, "batch_fix_ids": None}

        def fake_agent(finding, scan_result=None):
            captured["agent_ids"].append(finding["id"])
            return {"tool_calls": [{"tool": "search_cve", "args": {}, "result": {}}]}

        def fake_explain_batch(findings):
            captured["batch_explain_ids"] = [f["id"] for f in findings]
            return {f["id"]: dict(GOOD_EXPLAIN) for f in findings}

        def fake_fix_batch(findings):
            captured["batch_fix_ids"] = [f["id"] for f in findings]
            return {f["id"]: dict(GOOD_FIX) for f in findings}

        class _SkippedVerify:
            stage = "skipped"

        findings = self._build_findings()

        with patch.object(agent_service, "AGENT_ENABLED", True), patch.object(
            analysis_service, "run_agent_for_finding", side_effect=fake_agent
        ), patch.object(
            analysis_service, "generate_finding_explanation", return_value=GOOD_EXPLAIN
        ), patch.object(
            analysis_service, "generate_finding_fix", return_value=dict(GOOD_FIX)
        ), patch.object(
            analysis_service,
            "generate_findings_explanation_batch",
            side_effect=fake_explain_batch,
        ), patch.object(
            analysis_service, "generate_findings_fix_batch", side_effect=fake_fix_batch
        ), patch.object(
            analysis_service,
            "verify_and_maybe_regenerate",
            side_effect=lambda finding, fix: (fix, _SkippedVerify()),
        ):
            results = analysis_service.analyze_findings(
                findings, scan_result=SAMPLE_SCAN_RESULT
            )

        # agent는 HIGH+CVE 한 건만
        self.assertEqual(captured["agent_ids"], ["FND-AGENT-INT-001"])
        # 나머지 세 건만 batch로
        self.assertEqual(
            captured["batch_explain_ids"],
            ["FND-AGENT-INT-002", "FND-AGENT-INT-003", "FND-AGENT-INT-004"],
        )
        self.assertEqual(captured["batch_fix_ids"], captured["batch_explain_ids"])
        # 결과는 입력 순서 그대로 보존
        self.assertEqual(
            [r["findingId"] for r in results],
            [
                "FND-AGENT-INT-001",
                "FND-AGENT-INT-002",
                "FND-AGENT-INT-003",
                "FND-AGENT-INT-004",
            ],
        )
        # agent를 탄 finding에만 reasoningSteps 흔적 (enriched가 explain/fix로 전달됨)
        self.assertEqual(len(results), 4)


if __name__ == "__main__":
    unittest.main()
