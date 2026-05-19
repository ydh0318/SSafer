import json
import unittest
from unittest.mock import Mock, patch

from app.services import verify_service
from app.services.verify_service import (
    VerifyResult,
    extract_cve_ids,
    llm_verify,
    rule_based_verify,
    should_run_llm_verify,
    verify_and_maybe_regenerate,
)


def build_cve_finding(severity: str = "CRITICAL") -> dict:
    return {
        "id": "FND-0001",
        "ruleId": "CVE-2024-21626",
        "source": "trivy",
        "severity": severity,
        "scanType": "PROJECT_FILE",
        "file": "Dockerfile",
        "title": "runc CVE-2024-21626 container breakout",
        "maskedEvidence": "runc 1.1.7",
    }


def build_server_audit_finding() -> dict:
    return {
        "id": "FND-0002",
        "ruleId": "REDIS_PORT_OPEN",
        "source": "server-audit",
        "severity": "HIGH",
        "scanType": "SERVER_AUDIT",
        "target": "redis",
        "evidence": "6379/tcp open",
        "title": "Redis port 6379 exposed",
    }


def build_clean_fix(with_patches: bool = True) -> dict:
    fix = {
        "summary": "runc를 1.1.12 이상으로 업그레이드하세요.",
        "priority": "critical",
        "recommendedActions": [
            "CVE-2024-21626에 대응되는 runc 1.1.12로 업그레이드.",
            "컨테이너 재시작 후 동작 검증.",
        ],
        "codeGuidance": "runc 버전 핀을 1.1.12로 변경.",
        "verification": "runc --version으로 1.1.12 이상 확인.",
        "cautions": [],
    }
    if with_patches:
        fix["patches"] = [
            {
                "operation": "replace",
                "oldText": "runc=1.1.7",
                "newText": "runc=1.1.12",
            }
        ]
    return fix


class ExtractCveTest(unittest.TestCase):
    def test_extracts_canonical_cve(self):
        self.assertEqual(extract_cve_ids("CVE-2024-21626 found"), {"CVE-2024-21626"})

    def test_extracts_case_insensitive_and_dedupes(self):
        text = "cve-2024-21626 and CVE-2024-21626"
        self.assertEqual(extract_cve_ids(text), {"CVE-2024-21626"})

    def test_no_cve_returns_empty(self):
        self.assertEqual(extract_cve_ids("no cve here"), set())

    def test_none_input(self):
        self.assertEqual(extract_cve_ids(None), set())


class RuleBasedVerifyTest(unittest.TestCase):
    def test_clean_fix_passes(self):
        result = rule_based_verify(build_cve_finding(), build_clean_fix())
        self.assertTrue(result.passed)
        self.assertEqual(result.stage, "rule")

    def test_different_cve_in_fix_rejects(self):
        fix = build_clean_fix()
        fix["recommendedActions"] = ["CVE-2099-9999 다른 취약점 업데이트"]
        result = rule_based_verify(build_cve_finding(), fix)
        self.assertFalse(result.passed)
        self.assertEqual(result.stage, "rule")
        self.assertIn("CVE", result.reason or "")

    def test_no_cve_in_fix_is_ok_even_when_finding_has_cve(self):
        fix = build_clean_fix()
        fix["recommendedActions"] = ["runc 1.1.12로 업그레이드"]
        fix["summary"] = "runc 업그레이드"
        fix["codeGuidance"] = "runc 버전 핀 변경"
        fix["verification"] = "runc --version 확인"
        result = rule_based_verify(build_cve_finding(), fix)
        self.assertTrue(result.passed)

    def test_server_audit_with_patches_rejects(self):
        fix = build_clean_fix(with_patches=True)
        result = rule_based_verify(build_server_audit_finding(), fix)
        self.assertFalse(result.passed)
        self.assertIn("server-audit", result.reason or "")

    def test_server_audit_without_patches_passes(self):
        fix = build_clean_fix(with_patches=False)
        result = rule_based_verify(build_server_audit_finding(), fix)
        self.assertTrue(result.passed)


class ShouldRunLlmVerifyTest(unittest.TestCase):
    def test_high_with_patches_runs(self):
        with patch.object(verify_service, "VERIFY_LLM_ENABLED", True):
            self.assertTrue(
                should_run_llm_verify(build_cve_finding("HIGH"), build_clean_fix(True))
            )

    def test_critical_with_patches_runs(self):
        with patch.object(verify_service, "VERIFY_LLM_ENABLED", True):
            self.assertTrue(
                should_run_llm_verify(
                    build_cve_finding("CRITICAL"), build_clean_fix(True)
                )
            )

    def test_low_severity_skips(self):
        with patch.object(verify_service, "VERIFY_LLM_ENABLED", True):
            self.assertFalse(
                should_run_llm_verify(build_cve_finding("LOW"), build_clean_fix(True))
            )

    def test_no_patches_skips(self):
        with patch.object(verify_service, "VERIFY_LLM_ENABLED", True):
            self.assertFalse(
                should_run_llm_verify(
                    build_cve_finding("CRITICAL"), build_clean_fix(False)
                )
            )

    def test_disabled_globally_skips(self):
        with patch.object(verify_service, "VERIFY_LLM_ENABLED", False):
            self.assertFalse(
                should_run_llm_verify(
                    build_cve_finding("CRITICAL"), build_clean_fix(True)
                )
            )


class LlmVerifyTest(unittest.TestCase):
    def _make_chain(self, response_text: str) -> Mock:
        response = Mock()
        response.content = response_text
        chain = Mock()
        chain.invoke = Mock(return_value=response)
        return chain

    def test_passed_response(self):
        chain = self._make_chain(json.dumps({"passed": True, "reason": "ok"}))
        with patch("app.chains.verify_chain.create_verify_chain", return_value=chain):
            result = llm_verify(build_cve_finding(), build_clean_fix())
        self.assertTrue(result.passed)
        self.assertEqual(result.stage, "llm")
        self.assertIsNone(result.reason)

    def test_failed_response_carries_reason(self):
        chain = self._make_chain(
            json.dumps({"passed": False, "reason": "fix가 다른 CVE를 다룸"})
        )
        with patch("app.chains.verify_chain.create_verify_chain", return_value=chain):
            result = llm_verify(build_cve_finding(), build_clean_fix())
        self.assertFalse(result.passed)
        self.assertEqual(result.stage, "llm")
        self.assertEqual(result.reason, "fix가 다른 CVE를 다룸")

    def test_unparseable_response_fails_open(self):
        chain = self._make_chain("not json at all")
        with patch("app.chains.verify_chain.create_verify_chain", return_value=chain):
            result = llm_verify(build_cve_finding(), build_clean_fix())
        self.assertTrue(result.passed)
        self.assertEqual(result.stage, "llm_parse_failed")


class VerifyAndMaybeRegenerateTest(unittest.TestCase):
    def test_disabled_returns_skipped(self):
        with patch.object(verify_service, "VERIFY_ENABLED", False):
            fix = build_clean_fix()
            new_fix, result = verify_and_maybe_regenerate(build_cve_finding(), fix)
        self.assertIs(new_fix, fix)
        self.assertTrue(result.passed)
        self.assertEqual(result.stage, "skipped")

    def test_passes_first_time_skips_regen(self):
        with patch.object(verify_service, "VERIFY_ENABLED", True), patch.object(
            verify_service, "VERIFY_LLM_ENABLED", False
        ):
            fix = build_clean_fix()
            new_fix, result = verify_and_maybe_regenerate(build_cve_finding(), fix)
        self.assertIs(new_fix, fix)
        self.assertTrue(result.passed)
        self.assertEqual(result.retries, 0)

    def test_failed_verify_then_successful_regen_returns_regen_fix(self):
        bad = VerifyResult(passed=False, stage="rule", reason="실패")
        good = VerifyResult(passed=True, stage="rule")
        regen_fix = {"summary": "regenerated"}

        with patch.object(verify_service, "VERIFY_ENABLED", True), patch.object(
            verify_service, "verify_once", side_effect=[bad, good]
        ), patch.object(
            verify_service,
            "_regenerate_fix_with_feedback",
            return_value=regen_fix,
        ) as regen_mock:
            new_fix, result = verify_and_maybe_regenerate(
                build_cve_finding(), build_clean_fix()
            )

        self.assertIs(new_fix, regen_fix)
        self.assertTrue(result.passed)
        self.assertEqual(result.retries, 1)
        regen_mock.assert_called_once()

    def test_retry_cap_reached_returns_failed_with_max_retries(self):
        bad = VerifyResult(passed=False, stage="rule", reason="계속 실패")

        with patch.object(verify_service, "VERIFY_ENABLED", True), patch.object(
            verify_service, "MAX_VERIFY_RETRIES", 2
        ), patch.object(
            verify_service, "verify_once", return_value=bad
        ) as verify_mock, patch.object(
            verify_service,
            "_regenerate_fix_with_feedback",
            return_value={"summary": "regen"},
        ):
            _, result = verify_and_maybe_regenerate(
                build_cve_finding(), build_clean_fix()
            )

        self.assertFalse(result.passed)
        self.assertEqual(result.retries, 2)
        self.assertEqual(verify_mock.call_count, 3)

    def test_regen_exception_returns_original_fix_with_retry_count(self):
        bad = VerifyResult(passed=False, stage="rule", reason="실패")
        original_fix = build_clean_fix()

        with patch.object(verify_service, "VERIFY_ENABLED", True), patch.object(
            verify_service, "MAX_VERIFY_RETRIES", 1
        ), patch.object(
            verify_service, "verify_once", return_value=bad
        ), patch.object(
            verify_service,
            "_regenerate_fix_with_feedback",
            side_effect=ValueError("regen failed"),
        ):
            new_fix, result = verify_and_maybe_regenerate(
                build_cve_finding(), original_fix
            )

        self.assertIs(new_fix, original_fix)
        self.assertFalse(result.passed)
        self.assertEqual(result.retries, 1)


if __name__ == "__main__":
    unittest.main()
