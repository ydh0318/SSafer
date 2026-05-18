import unittest
from unittest.mock import MagicMock

from app.worker.consumer import should_requeue_exception
from app.worker.http_client import JsonHttpClientError
from app.worker.processor import RedeliveryTracker


class WorkerConsumerRetryPolicyTest(unittest.TestCase):
    def test_does_not_requeue_permanent_http_failures(self):
        for status_code in (400, 401, 403, 404, 409):
            with self.subTest(status_code=status_code):
                exc = JsonHttpClientError(
                    f"HTTP {status_code}",
                    status_code=status_code,
                )

                self.assertFalse(should_requeue_exception(exc))

    def test_requeues_transient_http_failures(self):
        for status_code in (408, 429, 500, 502, 503, 504):
            with self.subTest(status_code=status_code):
                exc = JsonHttpClientError(
                    f"HTTP {status_code}",
                    status_code=status_code,
                )

                self.assertTrue(should_requeue_exception(exc))

    def test_requeues_network_failures_without_status_code(self):
        exc = JsonHttpClientError("timed out")

        self.assertTrue(should_requeue_exception(exc))

    def test_requeues_unclassified_failures(self):
        self.assertTrue(should_requeue_exception(RuntimeError("unexpected")))


class RedeliveryCapDecisionTest(unittest.TestCase):
    """Verifies the consumer-side gate that drops messages beyond the cap.

    The actual integration runs inside on_message in consumer.py; here we
    exercise the same decision against a real RedeliveryTracker.
    """

    def test_record_below_cap_proceeds(self):
        tracker = RedeliveryTracker(cap=5)

        for _ in range(5):
            attempts = tracker.record(123)
            self.assertLessEqual(attempts, tracker.cap)

    def test_record_beyond_cap_signals_drop(self):
        tracker = RedeliveryTracker(cap=5)
        for _ in range(5):
            tracker.record(123)

        sixth = tracker.record(123)

        self.assertGreater(sixth, tracker.cap)


if __name__ == "__main__":
    unittest.main()
