import json
import unittest
from unittest.mock import patch

from app.api.analysis import analyze
from app.schemas.analysis import (
    AgentTaskResultRequest,
    AgentTaskStatusUpdateRequest,
    AnalysisRequest,
)


class AnalyzeEndpointTest(unittest.TestCase):
    def test_analysis_request_accepts_spring_integration_fields(self):
        request = AnalysisRequest(
            taskId=123,
            agentId=10,
            projectId=2,
            scanId=5,
            rawResultPath="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
            analysisResultPath=(
                "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
            ),
        )

        self.assertEqual(request.task_id, 123)
        self.assertEqual(request.agent_id, 10)
        self.assertEqual(request.project_id, 2)
        self.assertEqual(request.scan_id, 5)
        self.assertEqual(
            request.raw_result_path,
            "s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
        )
        self.assertEqual(
            request.analysis_result_s3_path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )

    def test_agent_task_callback_payloads_use_spring_field_names(self):
        status_update = AgentTaskStatusUpdateRequest(
            agentId=10,
            scanId=5,
            status="RUNNING",
            occurredAt="2026-05-06T04:00:10Z",
        )
        result_update = AgentTaskResultRequest(
            agentId=10,
            scanId=5,
            status="SUCCEEDED",
            analysisResultPath=(
                "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
            ),
            findingCount=3,
            validFindingCount=3,
            invalidFindingCount=0,
            resultCount=3,
            durationMs=73000,
        )

        self.assertEqual(
            status_update.model_dump(by_alias=True)["occurredAt"],
            "2026-05-06T04:00:10Z",
        )
        self.assertEqual(
            result_update.model_dump(by_alias=True)["analysisResultPath"],
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertEqual(result_update.model_dump(by_alias=True)["durationMs"], 73000)

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

    def test_analyze_endpoint_uses_spring_worker_s3_contract_fields(self):
        scan_result = {
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
                }
            ],
        }

        with patch(
            "app.services.analysis_service.download_scan_result_json_data",
            return_value=scan_result,
        ) as download, patch(
            "app.services.analysis_service.upload_analysis_result_json_data",
            return_value=(
                "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
            ),
        ) as upload, patch(
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
            response = analyze(
                AnalysisRequest(
                    taskId=123,
                    agentId=10,
                    projectId=2,
                    scanId=5,
                    rawResultPath=(
                        "s3://ssafer-scan-storage-dev/raw/5/scan_result.json"
                    ),
                    analysisResultPath=(
                        "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                    ),
                )
            )

        payload = (
            response.model_dump()
            if hasattr(response, "model_dump")
            else response.dict()
        )

        self.assertEqual(payload["status"], "completed")
        self.assertEqual(
            payload["scan_result_path"],
            "s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
        )
        self.assertEqual(
            payload["analysis_result_path"],
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertEqual(payload["result_count"], 1)
        download.assert_called_once_with(
            "s3://ssafer-scan-storage-dev/raw/5/scan_result.json"
        )
        upload.assert_called_once()
        self.assertEqual(
            upload.call_args.args[1],
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )

    def test_analyze_endpoint_returns_standard_input_error_response(self):
        with patch(
            "app.services.analysis_service.run_analysis_pipeline",
            return_value={
                "status": "failed",
                "stage": "input",
                "message": "scan_result.json file not found: missing.json",
                "scan_result_path": "missing.json",
                "analysis_result_path": "data/analysis_result.json",
            },
        ):
            response = analyze(AnalysisRequest(scan_result_path="missing.json"))

        payload = json.loads(response.body)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["error_code"], "ANALYSIS_INPUT_ERROR")
        self.assertEqual(payload["stage"], "input")
        self.assertEqual(
            payload["message"],
            "scan_result.json file not found: missing.json",
        )
        self.assertEqual(payload["scan_result_path"], "missing.json")

    def test_analyze_endpoint_returns_standard_llm_error_response(self):
        with patch(
            "app.services.analysis_service.run_analysis_pipeline",
            return_value={
                "status": "failed",
                "stage": "fix",
                "finding_id": "FND-0001",
                "message": "Fix Chain output could not be parsed.",
                "scan_result_path": "data/scan_result.json",
                "analysis_result_path": "data/analysis_result.json",
                "finding_count": 1,
                "valid_finding_count": 1,
                "invalid_finding_count": 0,
                "invalid_findings": [],
            },
        ):
            response = analyze(AnalysisRequest())

        payload = json.loads(response.body)

        self.assertEqual(response.status_code, 502)
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["error_code"], "ANALYSIS_FIX_ERROR")
        self.assertEqual(payload["stage"], "fix")
        self.assertEqual(payload["finding_id"], "FND-0001")
        self.assertEqual(payload["finding_count"], 1)


if __name__ == "__main__":
    unittest.main()
