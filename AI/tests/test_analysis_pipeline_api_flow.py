import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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
                return_value="테스트 설명",
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

            self.assertEqual(payload["status"], "completed_with_invalid_findings")
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


if __name__ == "__main__":
    unittest.main()
