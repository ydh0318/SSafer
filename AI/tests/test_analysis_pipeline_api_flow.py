import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.llm import LLMTimeoutError
from app.schemas.analysis import AnalysisRequest
from app.services.analysis_service import analyze_scan_result
from app.services.result_service import load_analysis_result


def build_scan_result():
    return {
        "schemaVersion": "0.1",
        "scanId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
        "source": "cli",
        "scannedAt": "2026-04-27T00:26:05Z",
        "analysisStatus": "SUCCESS",
        "findings": [
            {
                "id": "FND-0001",
                "ruleId": "ENV_PLAIN_SECRET",
                "source": "custom-rule",
                "severity": "HIGH",
                "file": ".env",
                "line": 1,
                "title": "Plain secret in env file",
                "maskedEvidence": "DB_PASSWORD=***MASKED***",
            },
            {
                "id": "FND-0002",
                "ruleId": "DS-0002",
                "source": "trivy",
                "severity": "HIGH",
                "file": "Dockerfile",
                "line": "two",
                "title": "Root user",
                "maskedEvidence": "USER root",
            },
        ],
    }


class AnalysisPipelineApiFlowTest(unittest.TestCase):
    def test_analyze_scan_result_runs_api_pipeline_and_saves_output(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "analysis_result.json"

            with patch(
                "app.services.analysis_service.generate_finding_explanation",
                return_value={
                    "explanation": {
                        "summary": "취약점 요약",
                        "whyRisky": "위험한 이유",
                        "abuseScenario": "악용 가능 시나리오",
                        "expectedImpact": "예상 영향",
                        "severityInterpretation": "심각도 해석",
                    },
                    "impact": "쉬운 비유 설명",
                },
            ), patch(
                "app.services.analysis_service.generate_finding_fix",
                return_value={
                    "summary": "테스트 수정 요약",
                    "priority": "high",
                    "recommendedActions": ["조치 1", "조치 2"],
                    "codeGuidance": "테스트 코드 가이드",
                    "verification": "테스트 검증",
                    "cautions": ["주의 1"],
                },
            ):
                response = analyze_scan_result(
                    AnalysisRequest(
                        scan_result_path="inline",
                        analysis_result_path=str(output_path),
                        scan_result=build_scan_result(),
                    )
                )

            payload = (
                response.model_dump()
                if hasattr(response, "model_dump")
                else response.dict()
            )

            self.assertEqual(payload["status"], "completed")
            self.assertEqual(payload["finding_count"], 2)
            self.assertEqual(payload["valid_finding_count"], 1)
            self.assertEqual(payload["invalid_finding_count"], 1)
            self.assertEqual(payload["result_count"], 1)
            self.assertEqual(
                payload["invalid_findings"][0]["findingId"],
                "FND-0002",
            )
            self.assertTrue(output_path.exists())

            analysis_result = load_analysis_result(str(output_path))
            self.assertEqual(analysis_result["resultCount"], 1)
            self.assertEqual(analysis_result["results"][0]["findingId"], "FND-0001")
            self.assertEqual(
                analysis_result["results"][0]["fix"]["summary"],
                "테스트 수정 요약",
            )
            self.assertEqual(
                analysis_result["results"][0]["explanation"]["summary"],
                "취약점 요약",
            )
            self.assertEqual(
                analysis_result["results"][0]["explanation"]["whyRisky"],
                "위험한 이유",
            )
            self.assertEqual(
                analysis_result["results"][0]["impact"],
                "쉬운 비유 설명",
            )

    def test_analyze_scan_result_normalizes_server_audit_and_omits_patches(self):
        server_audit_scan = {
            "schemaVersion": "0.1",
            "auditId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
            "source": "server-audit",
            "generatedAt": "2026-04-27T00:26:05Z",
            "findings": [
                {
                    "id": "SRV-0001",
                    "ruleId": "OPEN_PORT",
                    "source": "server-audit",
                    "severity": "HIGH",
                    "target": "port:5432",
                    "title": "DB 포트가 외부에 열려 있음",
                    "evidence": "0.0.0.0:5432 LISTEN",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "analysis_result.json"

            with patch(
                "app.services.analysis_service.generate_finding_explanation",
                return_value={
                    "explanation": {
                        "summary": "취약점 요약",
                        "whyRisky": "위험한 이유",
                        "abuseScenario": "악용 가능 시나리오",
                        "expectedImpact": "예상 영향",
                        "severityInterpretation": "심각도 해석",
                    },
                    "impact": "쉬운 비유 설명",
                },
            ), patch(
                "app.services.analysis_service.generate_finding_fix",
                return_value={
                    "summary": "운영 조치 요약",
                    "priority": "high",
                    "recommendedActions": ["조치 1", "조치 2"],
                    "codeGuidance": "보안 그룹과 방화벽 설정을 점검합니다.",
                    "verification": "ss -tlnp 와 방화벽 정책을 확인합니다.",
                    "cautions": [],
                    "patch": {
                        "patchId": "PATCH-SRV-0001",
                        "findingId": "SRV-0001",
                        "filePath": "ignored.txt",
                        "operation": "replace",
                        "oldText": "old",
                        "newText": "new",
                        "expectedFileHash": "sha256:abc123",
                    },
                },
            ):
                response = analyze_scan_result(
                    AnalysisRequest(
                        scan_result_path="inline",
                        analysis_result_path=str(output_path),
                        scanType="SERVER_AUDIT",
                        scan_result=server_audit_scan,
                    )
                )

            self.assertEqual(response.status, "completed")
            analysis_result = load_analysis_result(str(output_path))
            self.assertEqual(analysis_result["source"], "server-audit")
            self.assertEqual(analysis_result["scanId"], server_audit_scan["auditId"])
            self.assertNotIn("patches", analysis_result["results"][0]["fix"])

    def test_analyze_scan_result_reports_llm_timeout_error_code(self):
        with patch(
            "app.services.analysis_service.generate_finding_explanation",
            side_effect=LLMTimeoutError("LLM call failed after 3 attempt(s): timed out"),
        ):
            response = analyze_scan_result(
                AnalysisRequest(
                    scan_result_path="inline",
                    analysis_result_path="unused.json",
                    scan_result=build_scan_result(),
                )
            )

        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "LLM_TIMEOUT")
        self.assertEqual(response.stage, "explain")
        self.assertEqual(response.finding_id, "FND-0001")

    def test_analyze_scan_result_logs_scan_id_and_duration(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "analysis_result.json"

            with patch(
                "app.services.analysis_service.generate_finding_explanation",
                return_value={
                    "explanation": {
                        "summary": "취약점 요약",
                        "whyRisky": "위험한 이유",
                        "abuseScenario": "악용 가능 시나리오",
                        "expectedImpact": "예상 영향",
                        "severityInterpretation": "심각도 해석",
                    },
                    "impact": "쉬운 비유 설명",
                },
            ), patch(
                "app.services.analysis_service.generate_finding_fix",
                return_value={
                    "summary": "테스트 수정 요약",
                    "priority": "high",
                    "recommendedActions": ["조치 1", "조치 2"],
                    "codeGuidance": "테스트 코드 가이드",
                    "verification": "테스트 검증",
                    "cautions": ["주의 1"],
                },
            ), self.assertLogs("app.services.analysis_service", level="INFO") as logs:
                analyze_scan_result(
                    AnalysisRequest(
                        taskId=123,
                        agentId=10,
                        projectId=2,
                        scanId=5,
                        scan_result_path="inline",
                        analysis_result_path=str(output_path),
                        scan_result=build_scan_result(),
                    )
                )

        output = "\n".join(logs.output)
        self.assertIn("scanId=5", output)
        self.assertIn("taskId=123", output)
        self.assertIn("stage=PREPARE_INPUT", output)
        self.assertIn("stage=EXPLAIN", output)
        self.assertIn("stage=FIX", output)
        self.assertIn("stage=SAVE_RESULT", output)
        self.assertIn("stage=TASK_COMPLETED", output)
        self.assertIn("durationMs=", output)


if __name__ == "__main__":
    unittest.main()
