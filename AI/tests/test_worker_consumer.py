import unittest

from app.worker.consumer import should_requeue_exception
from app.worker.http_client import JsonHttpClientError


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


if __name__ == "__main__":
    unittest.main()
