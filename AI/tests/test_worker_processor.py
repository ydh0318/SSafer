import unittest
from concurrent.futures import ThreadPoolExecutor

from app.worker.config import WorkerSettings
from app.worker.processor import (
    build_analysis_result_path,
    ProcessOutcome,
    RedeliveryTracker,
    ScanTaskProcessor,
    TaskIdempotencyRegistry,
)
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
        spring_api_secret=None,
        analysis_result_bucket="ssafer-scan-storage-dev",
        analysis_result_prefix="analysis",
        http_timeout_seconds=120,
        max_concurrency=5,
        shutdown_timeout_seconds=1800,
        redelivery_cap=5,
        http_max_retries=2,
        http_retry_backoff_seconds=1.0,
        http_retry_backoff_max_seconds=30.0,
    )


def build_message() -> ScanRequestMessage:
    return ScanRequestMessage(
        messageType="SCAN_REQUEST",
        messageVersion=2,
        taskType="SCAN_REQUEST",
        taskId=123,
        agentId=10,
        projectId=2,
        scanId=5,
        scanType="PROJECT_FILE",
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
    def test_scan_request_message_accepts_version_2_scan_type(self):
        message = build_message()

        self.assertEqual(message.message_version, 2)
        self.assertEqual(message.scan_type, "PROJECT_FILE")

    def test_scan_request_message_accepts_server_audit_scan_type(self):
        message = ScanRequestMessage(
            messageType="SCAN_REQUEST",
            messageVersion=2,
            taskType="SCAN_REQUEST",
            taskId=123,
            agentId=10,
            projectId=2,
            scanId=5,
            scanType="SERVER_AUDIT",
            rawResultPath="s3://bucket/raw.json",
        )

        self.assertEqual(message.scan_type, "SERVER_AUDIT")

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
        self.assertEqual(fastapi_client.requests[0].scan_type, "PROJECT_FILE")
        self.assertEqual(
            fastapi_client.requests[0].analysis_result_path,
            "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
        )
        self.assertEqual(len(spring_client.callbacks), 2)
        running_scan_id, running_callback = spring_client.callbacks[0]
        self.assertEqual(running_scan_id, 5)
        self.assertEqual(running_callback.task_id, 123)
        self.assertEqual(running_callback.status, "RUNNING")
        self.assertEqual(running_callback.progress_step, "analysis_started")
        self.assertIsNone(running_callback.analysis_result_path)
        self.assertIsNotNone(running_callback.started_at)
        self.assertEqual(running_callback.last_updated_at, running_callback.started_at)

        scan_id, callback = spring_client.callbacks[1]
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
        self.assertIn("scanType=PROJECT_FILE", output)
        self.assertIn("stage=TASK_COMPLETED", output)
        self.assertIn("durationMs=", output)

        callback = spring_client.callbacks[1][1]
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

        self.assertEqual(len(spring_client.callbacks), 2)
        self.assertEqual(spring_client.callbacks[0][1].status, "RUNNING")
        scan_id, callback = spring_client.callbacks[1]
        self.assertEqual(scan_id, 5)
        self.assertEqual(callback.task_id, 123)
        self.assertEqual(callback.status, "FAILED")
        self.assertEqual(callback.progress_step, "analysis_failed")
        self.assertEqual(callback.stage, "analysis")
        self.assertEqual(callback.error_code, "UNKNOWN_ERROR")
        self.assertEqual(
            callback.failure_reason,
            "UNKNOWN_ERROR: FastAPI analysis failed: FastAPI down (stage=analysis)",
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
        self.assertIn("scanType=PROJECT_FILE", output)
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

        self.assertEqual(spring_client.callbacks[0][1].status, "RUNNING")
        callback = spring_client.callbacks[1][1]
        self.assertEqual(callback.status, "FAILED")
        self.assertEqual(callback.progress_step, "analysis_failed")
        self.assertEqual(callback.stage, "input")
        self.assertEqual(callback.error_code, "ANALYSIS_INPUT_ERROR")
        self.assertEqual(
            callback.failure_reason,
            (
                "ANALYSIS_INPUT_ERROR: FastAPI analysis failed: "
                "Failed to download scan_result.json from S3. (stage=input)"
            ),
        )

    def test_rejects_legacy_scan_request_message_version(self):
        with self.assertRaisesRegex(ValueError, "messageVersion"):
            ScanRequestMessage(
                messageType="SCAN_REQUEST",
                messageVersion=1,
                taskType="SCAN_REQUEST",
                taskId=123,
                agentId=10,
                projectId=2,
                scanId=5,
                scanType="PROJECT_FILE",
                rawResultPath="s3://bucket/raw.json",
            )

    def test_rejects_invalid_scan_type(self):
        with self.assertRaisesRegex(ValueError, "scanType"):
            ScanRequestMessage(
                messageType="SCAN_REQUEST",
                messageVersion=2,
                taskType="SCAN_REQUEST",
                taskId=123,
                agentId=10,
                projectId=2,
                scanId=5,
                scanType="PROJECT_SCAN",
                rawResultPath="s3://bucket/raw.json",
            )


class TaskIdempotencyRegistryTest(unittest.TestCase):
    def test_first_claim_succeeds_and_duplicate_in_flight_is_rejected(self):
        registry = TaskIdempotencyRegistry()

        self.assertTrue(registry.claim(123))
        self.assertFalse(registry.claim(123))

    def test_release_without_completion_allows_retry(self):
        registry = TaskIdempotencyRegistry()
        registry.claim(123)
        registry.release(123, completed=False)

        self.assertTrue(registry.claim(123))

    def test_recently_completed_blocks_future_claim(self):
        registry = TaskIdempotencyRegistry()
        registry.claim(123)
        registry.release(123, completed=True)

        self.assertFalse(registry.claim(123))

    def test_completed_lru_evicts_oldest_beyond_capacity(self):
        registry = TaskIdempotencyRegistry(max_completed=2)
        for task_id in (1, 2, 3):
            registry.claim(task_id)
            registry.release(task_id, completed=True)

        self.assertTrue(registry.claim(1))
        self.assertFalse(registry.claim(2))
        self.assertFalse(registry.claim(3))

    def test_concurrent_claim_grants_exactly_one(self):
        registry = TaskIdempotencyRegistry()

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: registry.claim(42), range(8)))

        self.assertEqual(sum(1 for granted in results if granted), 1)


class WorkerProcessorIdempotencyTest(unittest.TestCase):
    def _build_processor(self, fastapi_client=None, registry=None):
        spring_client = FakeSpringClient()
        if fastapi_client is None:
            fastapi_client = FakeFastApiClient(
                FastApiAnalyzeResponse(
                    status="completed",
                    scan_result_path=(
                        "s3://ssafer-scan-storage-dev/raw/5/scan_result.json"
                    ),
                    analysis_result_path=(
                        "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                    ),
                )
            )
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
            idempotency_registry=registry,
        )
        return processor, spring_client, fastapi_client

    def test_duplicate_in_flight_skips_pipeline_and_callbacks(self):
        registry = TaskIdempotencyRegistry()
        processor, spring_client, fastapi_client = self._build_processor(
            registry=registry,
        )
        registry.claim(123)

        processor.process(build_message())

        self.assertEqual(fastapi_client.requests, [])
        self.assertEqual(spring_client.callbacks, [])

    def test_duplicate_after_completion_skips_pipeline_and_callbacks(self):
        registry = TaskIdempotencyRegistry()
        processor, spring_client, fastapi_client = self._build_processor(
            registry=registry,
        )

        processor.process(build_message())
        self.assertEqual(len(fastapi_client.requests), 1)
        self.assertEqual(len(spring_client.callbacks), 2)

        processor.process(build_message())

        self.assertEqual(len(fastapi_client.requests), 1)
        self.assertEqual(len(spring_client.callbacks), 2)

    def test_skipped_duplicate_emits_log(self):
        registry = TaskIdempotencyRegistry()
        processor, _spring_client, _fastapi_client = self._build_processor(
            registry=registry,
        )
        registry.claim(123)

        with self.assertLogs("app.worker.processor", level="INFO") as logs:
            processor.process(build_message())

        output = "\n".join(logs.output)
        self.assertIn("Skipping duplicate scan task delivery.", output)
        self.assertIn("taskId=123", output)
        self.assertIn("status=SKIPPED_DUPLICATE", output)

    def test_process_returns_processed_outcome_on_success(self):
        processor, _spring, _fastapi = self._build_processor()

        outcome = processor.process(build_message())

        self.assertEqual(outcome, ProcessOutcome.PROCESSED)

    def test_process_returns_skipped_duplicate_outcome(self):
        registry = TaskIdempotencyRegistry()
        processor, _spring, _fastapi = self._build_processor(registry=registry)
        registry.claim(123)

        outcome = processor.process(build_message())

        self.assertEqual(outcome, ProcessOutcome.SKIPPED_DUPLICATE)


class RedeliveryTrackerTest(unittest.TestCase):
    def test_record_increments_per_task_id(self):
        tracker = RedeliveryTracker(cap=5)

        self.assertEqual(tracker.record(101), 1)
        self.assertEqual(tracker.record(101), 2)
        self.assertEqual(tracker.record(102), 1)

    def test_clear_resets_counter(self):
        tracker = RedeliveryTracker(cap=5)
        tracker.record(101)
        tracker.record(101)

        tracker.clear(101)

        self.assertEqual(tracker.current(101), 0)
        self.assertEqual(tracker.record(101), 1)

    def test_current_reads_without_increment(self):
        tracker = RedeliveryTracker(cap=5)
        tracker.record(101)

        self.assertEqual(tracker.current(101), 1)
        self.assertEqual(tracker.current(101), 1)
        self.assertEqual(tracker.current(999), 0)

    def test_concurrent_record_counts_every_call(self):
        tracker = RedeliveryTracker(cap=100)

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: tracker.record(42), range(50)))

        self.assertEqual(tracker.current(42), 50)


class WorkerProcessorRedeliveryTest(unittest.TestCase):
    def test_successful_process_clears_redelivery_tracker(self):
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
        tracker = RedeliveryTracker(cap=5)
        tracker.record(123)
        tracker.record(123)
        processor = ScanTaskProcessor(
            spring_client=spring_client,
            fastapi_client=fastapi_client,
            settings=build_settings(),
            redelivery_tracker=tracker,
        )

        processor.process(build_message())

        self.assertEqual(tracker.current(123), 0)

    def test_failed_process_keeps_redelivery_tracker(self):
        class ExplodingSpringClient:
            def send_analysis_result_callback(self, scan_id, request):
                raise RuntimeError("Spring down")

        fastapi_client = FakeFastApiClient(
            FastApiAnalyzeResponse(
                status="completed",
                scan_result_path="s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
                analysis_result_path=(
                    "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
                ),
            )
        )
        tracker = RedeliveryTracker(cap=5)
        tracker.record(123)
        tracker.record(123)
        processor = ScanTaskProcessor(
            spring_client=ExplodingSpringClient(),
            fastapi_client=fastapi_client,
            settings=build_settings(),
            redelivery_tracker=tracker,
        )

        with self.assertRaises(RuntimeError):
            processor.process(build_message())

        self.assertEqual(tracker.current(123), 2)


if __name__ == "__main__":
    unittest.main()
