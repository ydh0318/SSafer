import unittest

from app.worker.fastapi_client import FastApiClient
from app.worker.http_client import JsonHttpClientError
from app.worker.schemas import AnalysisResultCallbackRequest, FastApiAnalyzeRequest
from app.worker.spring_client import SpringClient


class FakeHttpClient:
    def __init__(self):
        self.posts = []

    def post_json(self, path, payload):
        self.posts.append((path, payload))
        if path != "/analyze":
            return {"success": True}
        return {
            "status": "completed",
            "scan_result_path": payload["rawResultPath"],
            "analysis_result_path": payload["analysisResultPath"],
            "finding_count": 1,
            "valid_finding_count": 1,
            "invalid_finding_count": 0,
            "result_count": 1,
        }


class FakeFailingHttpClient:
    def post_json(self, path, payload):
        del path, payload
        raise JsonHttpClientError(
            "POST /analyze failed with HTTP 400",
            status_code=400,
            response_json={
                "status": "failed",
                "error_code": "S3_DOWNLOAD_FAILED",
                "message": "Failed to download scan_result.json from S3.",
                "stage": "input",
                "scan_result_path": (
                    "s3://ssafer-scan-storage-dev/raw/5/scan_result.json"
                ),
                "analysis_result_path": (
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
                "finding_count": 0,
                "valid_finding_count": 0,
                "invalid_finding_count": 0,
                "result_count": 0,
                "invalid_findings": [],
            },
        )


class FastApiClientTest(unittest.TestCase):
    def test_analyze_posts_spring_contract_payload_to_analyze(self):
        http_client = FakeHttpClient()
        client = FastApiClient(http_client)

        response = client.analyze(
            FastApiAnalyzeRequest(
                taskId=123,
                agentId=10,
                projectId=2,
                scanId=5,
                rawResultPath="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysisResultPath=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            )
        )

        self.assertEqual(len(http_client.posts), 1)
        path, payload = http_client.posts[0]
        self.assertEqual(path, "/analyze")
        self.assertEqual(
            payload,
            {
                "taskId": 123,
                "agentId": 10,
                "projectId": 2,
                "scanId": 5,
                "rawResultPath": (
                    "s3://ssafer-scan-storage-dev/raw/5/scan_result.json"
                ),
                "analysisResultPath": (
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            },
        )
        self.assertTrue(response.succeeded)
        self.assertEqual(response.result_count, 1)

    def test_analyze_preserves_standard_error_body_from_http_error(self):
        client = FastApiClient(FakeFailingHttpClient())

        response = client.analyze(
            FastApiAnalyzeRequest(
                taskId=123,
                agentId=10,
                projectId=2,
                scanId=5,
                rawResultPath="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysisResultPath=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            )
        )

        self.assertFalse(response.succeeded)
        self.assertEqual(response.error_code, "S3_DOWNLOAD_FAILED")
        self.assertEqual(response.stage, "input")
        self.assertEqual(
            response.message,
            "Failed to download scan_result.json from S3.",
        )


class SpringClientTest(unittest.TestCase):
    def test_send_analysis_result_callback_accepts_running_status(self):
        http_client = FakeHttpClient()
        client = SpringClient(http_client)

        client.send_analysis_result_callback(
            5,
            AnalysisResultCallbackRequest(
                taskId=123,
                status="RUNNING",
                progressStep="analysis_started",
                startedAt="2026-05-06T04:00:00",
                lastUpdatedAt="2026-05-06T04:00:00",
            ),
        )

        path, payload = http_client.posts[0]
        self.assertEqual(path, "/api/v1/internal/scans/5/analysis-results")
        self.assertEqual(
            payload,
            {
                "taskId": 123,
                "status": "RUNNING",
                "progressStep": "analysis_started",
                "failureReason": None,
                "analysisResultPath": None,
                "startedAt": "2026-05-06T04:00:00",
                "completedAt": None,
                "lastUpdatedAt": "2026-05-06T04:00:00",
            },
        )

    def test_send_analysis_result_callback_posts_latest_spring_contract(self):
        http_client = FakeHttpClient()
        client = SpringClient(http_client)

        client.send_analysis_result_callback(
            5,
            AnalysisResultCallbackRequest(
                taskId=123,
                status="DONE",
                progressStep="analysis_completed",
                analysisResultPath=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
                startedAt="2026-05-06T04:00:00",
                completedAt="2026-05-06T04:05:00",
                lastUpdatedAt="2026-05-06T04:05:00",
            ),
        )

        path, payload = http_client.posts[0]
        self.assertEqual(path, "/api/v1/internal/scans/5/analysis-results")
        self.assertEqual(
            payload,
            {
                "taskId": 123,
                "status": "DONE",
                "progressStep": "analysis_completed",
                "failureReason": None,
                "analysisResultPath": (
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
                "startedAt": "2026-05-06T04:00:00",
                "completedAt": "2026-05-06T04:05:00",
                "lastUpdatedAt": "2026-05-06T04:05:00",
            },
        )


if __name__ == "__main__":
    unittest.main()
