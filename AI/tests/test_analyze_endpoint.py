import unittest
from unittest.mock import patch

from app.api.analysis import analyze
from app.schemas.analysis import AnalysisRequest


class AnalyzeEndpointTest(unittest.TestCase):
    def test_analyze_endpoint_runs_analysis_pipeline(self):
        captured_args = {}

        def fake_run_analysis_pipeline(scan_result_path: str, output_path: str):
            captured_args["scan_result_path"] = scan_result_path
            captured_args["output_path"] = output_path
            return {
                "status": "completed",
                "scan_result_path": scan_result_path,
                "analysis_result_path": output_path,
                "finding_count": 1,
                "valid_finding_count": 1,
                "invalid_finding_count": 0,
                "invalid_findings": [],
                "result_count": 1,
            }

        with patch(
            "app.services.analysis_service.run_analysis_pipeline",
            fake_run_analysis_pipeline,
        ):
            response = analyze(
                AnalysisRequest(
                    scan_result_path="data/custom_scan_result.json",
                    analysis_result_path="data/custom_analysis_result.json",
                )
            )

        payload = (
            response.model_dump()
            if hasattr(response, "model_dump")
            else response.dict()
        )

        self.assertEqual(
            payload,
            {
                "status": "completed",
                "message": None,
                "stage": None,
                "finding_id": None,
                "scan_result_path": "data/custom_scan_result.json",
                "analysis_result_path": "data/custom_analysis_result.json",
                "finding_count": 1,
                "valid_finding_count": 1,
                "invalid_finding_count": 0,
                "result_count": 1,
                "invalid_findings": [],
            },
        )
        self.assertEqual(
            captured_args,
            {
                "scan_result_path": "data/custom_scan_result.json",
                "output_path": "data/custom_analysis_result.json",
            },
        )

    def test_analyze_endpoint_accepts_inline_scan_result_dto(self):
        captured_args = {}

        def fake_run_analysis_pipeline_from_scan_result(
            scan_result,
            scan_result_path: str,
            output_path: str,
        ):
            captured_args["scan_result"] = scan_result
            captured_args["scan_result_path"] = scan_result_path
            captured_args["output_path"] = output_path
            return {
                "status": "completed",
                "scan_result_path": scan_result_path,
                "analysis_result_path": output_path,
                "finding_count": 1,
                "valid_finding_count": 1,
                "invalid_finding_count": 0,
                "invalid_findings": [],
                "result_count": 1,
            }

        with patch(
            "app.services.analysis_service.run_analysis_pipeline_from_scan_result",
            fake_run_analysis_pipeline_from_scan_result,
        ):
            response = analyze(
                AnalysisRequest(
                    scan_result_path="inline",
                    analysis_result_path="data/custom_analysis_result.json",
                    scan_result={
                        "schemaVersion": "0.1",
                        "scanId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
                        "source": "cli",
                        "scannedAt": "2026-04-27T00:26:05Z",
                        "analysisStatus": "SUCCESS",
                        "findings": [],
                    },
                )
            )

        payload = (
            response.model_dump()
            if hasattr(response, "model_dump")
            else response.dict()
        )

        self.assertEqual(payload["status"], "completed")
        self.assertEqual(captured_args["scan_result_path"], "inline")
        self.assertEqual(
            captured_args["output_path"],
            "data/custom_analysis_result.json",
        )
        self.assertEqual(captured_args["scan_result"]["schemaVersion"], "0.1")
        self.assertEqual(
            captured_args["scan_result"]["scanId"],
            "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
        )


if __name__ == "__main__":
    unittest.main()
