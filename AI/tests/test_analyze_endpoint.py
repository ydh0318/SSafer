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


if __name__ == "__main__":
    unittest.main()
