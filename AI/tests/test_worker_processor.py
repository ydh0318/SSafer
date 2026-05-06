import unittest

from app.worker.config import WorkerSettings
from app.worker.processor import build_analysis_result_path, ScanTaskProcessor
from app.worker.schemas import FastApiAnalyzeResponse, ScanRequestMessage


def build_settings() -> WorkerSettings:
    return WorkerSettings(
        rabbitmq_host="localhost",
        rabbitmq_port=5672,
        rabbitmq_username="guest",
        rabbitmq_password="guest",
        rabbitmq_virtual_host="/",
        scan_request_queue="ssafer.agent.scan.request",
        fastapi_base_url="http://127.0.0.1:8000",
        spring_base_url="http://127.0.0.1:8080",
        spring_worker_secret=None,
        analysis_result_bucket="ssafer-scan-storage-dev",
        analysis_result_prefix="analysis",
        http_timeout_seconds=120,
    )


def build_message() -> ScanRequestMessage:
    return ScanRequestMessage(
        messageType="SCAN_REQUEST",
        messageVersion=1,
        taskType="SCAN_REQUEST",
        taskId=123,
        agentId=10,
        projectId=2,
        scanId=5,
        rawResultPath="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
        resultCount=1,
        tool="ssafer-cli",
        toolVersion="1.4.0",
        payloadHash=None,
        queuedAt="2026-05-06T04:00:00Z",
    )


class FakeSpringClient:
    def __init__(self):
        self.status_updates = []
        self.results = []

    def update_task_status(self, task_id, request):
        self.status_updates.append((task_id, request))
        return {"success": True}

    def send_task_result(self, task_id, request):
        self.results.append((task_id, request))
        return {"success": True}


class FakeFastApiClient:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.requests = []

    def analyze(self, request):
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        return self.response


class WorkerProcessorTest(unittest.TestCase):
    def test_build_analysis_result_path_uses_configured_bucket(self):
        path = build_analysis_result_path(build_message(), build_settings())

        self.assertEqual(
            path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )

    def test_process_reports_success_flow(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(
            FastApiAnalyzeResponse(
                status="completed",
                scan_result_path="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysis_result_path=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
                finding_count=3,
                valid_finding_count=3,
                invalid_finding_count=0,
                result_count=3,
            )
        )
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        processor.process(build_message())

        self.assertEqual(
            [request.status for _, request in spring_client.status_updates],
            ["ACKED", "RUNNING"],
        )
        self.assertEqual(fastapi_client.requests[0].task_id, 123)
        self.assertEqual(
            fastapi_client.requests[0].analysis_result_path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertEqual(len(spring_client.results), 1)
        result = spring_client.results[0][1]
        self.assertEqual(result.status, "SUCCEEDED")
        self.assertEqual(result.result_count, 3)

    def test_process_reports_failed_when_fastapi_fails(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(error=RuntimeError("FastAPI down"))
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        processor.process(build_message())

        self.assertEqual(
            [request.status for _, request in spring_client.status_updates],
            ["ACKED", "RUNNING"],
        )
        result = spring_client.results[0][1]
        self.assertEqual(result.status, "FAILED")
        self.assertEqual(result.error_code, "FASTAPI_ANALYZE_FAILED")
        self.assertEqual(result.stage, "ANALYZE_REQUEST")
        self.assertTrue(result.retryable)

    def test_rejects_invalid_scan_request_message(self):
        with self.assertRaisesRegex(ValueError, "messageVersion"):
            ScanRequestMessage(
                messageType="SCAN_REQUEST",
                messageVersion=2,
                taskType="SCAN_REQUEST",
                taskId=123,
                agentId=10,
                projectId=2,
                scanId=5,
                rawResultPath="s3://bucket/raw.json",
            )


if __name__ == "__main__":
    unittest.main()
