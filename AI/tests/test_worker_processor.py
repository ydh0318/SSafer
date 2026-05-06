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
        self.callbacks = []

    def send_analysis_result_callback(self, scan_id, request):
        self.callbacks.append((scan_id, request))
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

        self.assertEqual(fastapi_client.requests[0].task_id, 123)
        self.assertEqual(
            fastapi_client.requests[0].analysis_result_path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertEqual(len(spring_client.callbacks), 1)
        scan_id, callback = spring_client.callbacks[0]
        self.assertEqual(scan_id, 5)
        self.assertEqual(callback.task_id, 123)
        self.assertEqual(callback.status, "DONE")
        self.assertEqual(callback.progress_step, "analysis_completed")
        self.assertEqual(
            callback.analysis_result_path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertIsNotNone(callback.started_at)
        self.assertIsNotNone(callback.completed_at)
        self.assertEqual(callback.last_updated_at, callback.completed_at)

    def test_process_logs_scan_id_and_duration_without_callback_payload_change(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(
            FastApiAnalyzeResponse(
                status="completed",
                scan_result_path="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysis_result_path=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            )
        )
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        with self.assertLogs("app.worker.processor", level="INFO") as logs:
            processor.process(build_message())

        output = "\n".join(logs.output)
        self.assertIn("scanId=5", output)
        self.assertIn("taskId=123", output)
        self.assertIn("stage=TASK_COMPLETED", output)
        self.assertIn("durationMs=", output)

        callback = spring_client.callbacks[0][1]
        self.assertNotIn("durationMs", callback.model_dump(by_alias=True))

    def test_process_reports_failed_when_fastapi_fails(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(error=RuntimeError("FastAPI down"))
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        processor.process(build_message())

        self.assertEqual(len(spring_client.callbacks), 1)
        scan_id, callback = spring_client.callbacks[0]
        self.assertEqual(scan_id, 5)
        self.assertEqual(callback.task_id, 123)
        self.assertEqual(callback.status, "FAILED")
        self.assertEqual(callback.progress_step, "analysis_failed")
        self.assertEqual(callback.error_code, "UNKNOWN_ERROR")
        self.assertEqual(
            callback.failure_reason,
            "UNKNOWN_ERROR: FastAPI analysis failed: FastAPI down",
        )
        self.assertIsNone(callback.analysis_result_path)

    def test_process_logs_failed_scan_id_and_duration(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(error=RuntimeError("FastAPI down"))
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        with self.assertLogs("app.worker.processor", level="ERROR") as logs:
            processor.process(build_message())

        output = "\n".join(logs.output)
        self.assertIn("scanId=5", output)
        self.assertIn("taskId=123", output)
        self.assertIn("stage=TASK_FAILED", output)
        self.assertIn("status=FAILED", output)
        self.assertIn("errorCode=UNKNOWN_ERROR", output)
        self.assertIn("durationMs=", output)

    def test_process_reports_failed_when_fastapi_returns_failed_response(self):
        spring_client = FakeSpringClient()
        fastapi_client = FakeFastApiClient(
            FastApiAnalyzeResponse(
                status="failed",
                error_code="ANALYSIS_INPUT_ERROR",
                message="Failed to download scan_result.json from S3.",
                stage="input",
                scan_result_path="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysis_result_path=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            )
        )
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
        )

        processor.process(build_message())

        callback = spring_client.callbacks[0][1]
        self.assertEqual(callback.status, "FAILED")
        self.assertEqual(callback.progress_step, "analysis_failed")
        self.assertEqual(callback.error_code, "ANALYSIS_INPUT_ERROR")
        self.assertEqual(
            callback.failure_reason,
            (
                "ANALYSIS_INPUT_ERROR: FastAPI analysis failed: "
                "Failed to download scan_result.json from S3. (stage=input)"
            ),
        )

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
