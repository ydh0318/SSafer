import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.worker.async_consumer import process_message
from app.worker.http_client import JsonHttpClientError


VALID_MESSAGE_PAYLOAD = {
    "messageType": "SCAN_REQUEST",
    "messageVersion": 2,
    "taskType": "SCAN_REQUEST",
    "taskId": 1,
    "agentId": 1,
    "projectId": 1,
    "scanId": 100,
    "scanType": "PROJECT_FILE",
    "rawResultPath": "s3://bucket/raw/result.json",
}


def _make_aio_message(payload: dict | bytes) -> AsyncMock:
    message = AsyncMock()
    if isinstance(payload, bytes):
        message.body = payload
    else:
        message.body = json.dumps(payload).encode("utf-8")
    message.ack = AsyncMock()
    message.nack = AsyncMock()
    return message


class AsyncConsumerProcessMessageTest(unittest.IsolatedAsyncioTestCase):
    """Tests for the core message processing logic extracted from async_consumer."""

    async def test_valid_message_calls_processor_and_acks(self):
        processor = MagicMock()
        processor.process = MagicMock()
        message = _make_aio_message(VALID_MESSAGE_PAYLOAD)
        semaphore = asyncio.Semaphore(5)

        await process_message(message, processor=processor, semaphore=semaphore)

        processor.process.assert_called_once()
        message.ack.assert_called_once()
        message.nack.assert_not_called()

    async def test_invalid_json_nacks_without_requeue(self):
        processor = MagicMock()
        message = _make_aio_message(b"not valid json")

        await process_message(
            message,
            processor=processor,
            semaphore=asyncio.Semaphore(5),
        )

        message.nack.assert_called_once_with(requeue=False)
        message.ack.assert_not_called()
        processor.process.assert_not_called()

    async def test_invalid_schema_nacks_without_requeue(self):
        processor = MagicMock()
        bad_payload = {**VALID_MESSAGE_PAYLOAD, "messageType": "WRONG"}
        message = _make_aio_message(bad_payload)

        await process_message(
            message,
            processor=processor,
            semaphore=asyncio.Semaphore(5),
        )

        message.nack.assert_called_once_with(requeue=False)
        message.ack.assert_not_called()
        processor.process.assert_not_called()

    async def test_processor_exception_nacks_with_requeue_for_transient(self):
        processor = MagicMock()
        processor.process = MagicMock(
            side_effect=JsonHttpClientError("HTTP 500", status_code=500)
        )
        message = _make_aio_message(VALID_MESSAGE_PAYLOAD)

        await process_message(
            message,
            processor=processor,
            semaphore=asyncio.Semaphore(5),
        )

        message.nack.assert_called_once_with(requeue=True)
        message.ack.assert_not_called()

    async def test_processor_exception_nacks_without_requeue_for_permanent(self):
        processor = MagicMock()
        processor.process = MagicMock(
            side_effect=JsonHttpClientError("HTTP 400", status_code=400)
        )
        message = _make_aio_message(VALID_MESSAGE_PAYLOAD)

        await process_message(
            message,
            processor=processor,
            semaphore=asyncio.Semaphore(5),
        )

        message.nack.assert_called_once_with(requeue=False)
        message.ack.assert_not_called()

    async def test_semaphore_limits_concurrent_processing(self):
        max_concurrency = 2
        semaphore = asyncio.Semaphore(max_concurrency)
        concurrent_count = 0
        max_observed = 0
        lock = asyncio.Lock()

        async def mock_process(_msg):
            nonlocal concurrent_count, max_observed
            async with semaphore:
                async with lock:
                    concurrent_count += 1
                    max_observed = max(max_observed, concurrent_count)
                await asyncio.sleep(0.05)
                async with lock:
                    concurrent_count -= 1

        tasks = [
            asyncio.create_task(mock_process(None))
            for _ in range(5)
        ]
        await asyncio.gather(*tasks)

        self.assertLessEqual(max_observed, max_concurrency)

    async def test_shutdown_event_stops_processing(self):
        shutdown_event = asyncio.Event()

        async def wait_then_shutdown():
            await asyncio.sleep(0.05)
            shutdown_event.set()

        asyncio.create_task(wait_then_shutdown())
        await shutdown_event.wait()

        self.assertTrue(shutdown_event.is_set())


class WorkerSettingsConcurrencyTest(unittest.TestCase):
    def test_default_max_concurrency(self):
        from app.worker.config import load_worker_settings

        settings = load_worker_settings(env={
            "RABBITMQ_HOST": "localhost",
            "APP_ANALYSIS_RESULT_S3_BUCKET": "test-bucket",
        })
        self.assertEqual(settings.max_concurrency, 5)
        self.assertEqual(settings.shutdown_timeout_seconds, 1800)

    def test_custom_max_concurrency(self):
        from app.worker.config import load_worker_settings

        settings = load_worker_settings(env={
            "RABBITMQ_HOST": "localhost",
            "APP_ANALYSIS_RESULT_S3_BUCKET": "test-bucket",
            "WORKER_MAX_CONCURRENCY": "10",
            "WORKER_SHUTDOWN_TIMEOUT_SECONDS": "300",
        })
        self.assertEqual(settings.max_concurrency, 10)
        self.assertEqual(settings.shutdown_timeout_seconds, 300)

    def test_zero_max_concurrency_is_rejected(self):
        from app.worker.config import load_worker_settings

        with self.assertRaises(ValueError):
            load_worker_settings(env={
                "RABBITMQ_HOST": "localhost",
                "APP_ANALYSIS_RESULT_S3_BUCKET": "test-bucket",
                "WORKER_MAX_CONCURRENCY": "0",
            })

    def test_zero_shutdown_timeout_is_rejected(self):
        from app.worker.config import load_worker_settings

        with self.assertRaises(ValueError):
            load_worker_settings(env={
                "RABBITMQ_HOST": "localhost",
                "APP_ANALYSIS_RESULT_S3_BUCKET": "test-bucket",
                "WORKER_SHUTDOWN_TIMEOUT_SECONDS": "0",
            })


if __name__ == "__main__":
    unittest.main()
