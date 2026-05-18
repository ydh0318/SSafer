import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from app.worker.http_client import (
    JsonHttpClient,
    JsonHttpClientError,
    RETRYABLE_STATUS_CODES,
)


def _make_http_error(status_code: int, body: str = "") -> HTTPError:
    return HTTPError(
        url="http://example.invalid/path",
        code=status_code,
        msg="Server error",
        hdrs=None,  # type: ignore[arg-type]
        fp=io.BytesIO(body.encode("utf-8")),
    )


def _make_url_error(reason: str = "connection refused") -> URLError:
    return URLError(reason=reason)


class _FakeResponse:
    def __init__(self, body: bytes):
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _make_success_response(payload: dict) -> _FakeResponse:
    return _FakeResponse(json.dumps(payload).encode("utf-8"))


class JsonHttpClientRetryTest(unittest.TestCase):
    def _build_client(self, max_retries: int = 2) -> JsonHttpClient:
        return JsonHttpClient(
            base_url="http://example.invalid",
            timeout_seconds=5,
            max_retries=max_retries,
            retry_backoff_seconds=0.01,
            retry_backoff_max_seconds=0.01,
        )

    def test_retries_url_error_then_succeeds(self):
        client = self._build_client(max_retries=2)
        responses = [
            _make_url_error(),
            _make_url_error(),
            _make_success_response({"ok": True}),
        ]

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ) as mock_sleep:
            def side_effect(*_args, **_kwargs):
                response = responses.pop(0)
                if isinstance(response, Exception):
                    raise response
                return response

            mock_urlopen.side_effect = side_effect
            result = client.post_json("/echo", {"hello": "world"})

        self.assertEqual(result, {"ok": True})
        self.assertEqual(mock_urlopen.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)

    def test_retries_transient_5xx_then_succeeds(self):
        client = self._build_client(max_retries=2)
        responses = [
            _make_http_error(503, '{"error": "down"}'),
            _make_success_response({"ok": True}),
        ]

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ):
            def side_effect(*_args, **_kwargs):
                response = responses.pop(0)
                if isinstance(response, Exception):
                    raise response
                return response

            mock_urlopen.side_effect = side_effect
            result = client.post_json("/spring", {"foo": "bar"})

        self.assertEqual(result, {"ok": True})
        self.assertEqual(mock_urlopen.call_count, 2)

    def test_does_not_retry_permanent_4xx(self):
        client = self._build_client(max_retries=3)

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ) as mock_sleep:
            mock_urlopen.side_effect = _make_http_error(400, '{"error":"bad"}')

            with self.assertRaises(JsonHttpClientError) as ctx:
                client.post_json("/spring", {"foo": "bar"})

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.response_json, {"error": "bad"})
        self.assertEqual(mock_urlopen.call_count, 1)
        mock_sleep.assert_not_called()

    def test_raises_after_exhausting_retries(self):
        client = self._build_client(max_retries=2)

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ):
            mock_urlopen.side_effect = _make_http_error(503, "")

            with self.assertRaises(JsonHttpClientError) as ctx:
                client.post_json("/spring", {"foo": "bar"})

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(mock_urlopen.call_count, 3)

    def test_url_error_after_max_retries_propagates(self):
        client = self._build_client(max_retries=1)

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ):
            mock_urlopen.side_effect = _make_url_error("timed out")

            with self.assertRaises(JsonHttpClientError) as ctx:
                client.post_json("/spring", {"foo": "bar"})

        self.assertIsNone(ctx.exception.status_code)
        self.assertEqual(mock_urlopen.call_count, 2)

    def test_zero_retries_acts_as_single_attempt(self):
        client = self._build_client(max_retries=0)

        with patch("app.worker.http_client.urlopen") as mock_urlopen, patch(
            "app.worker.http_client.time.sleep"
        ) as mock_sleep:
            mock_urlopen.side_effect = _make_url_error()

            with self.assertRaises(JsonHttpClientError):
                client.post_json("/spring", {"foo": "bar"})

        self.assertEqual(mock_urlopen.call_count, 1)
        mock_sleep.assert_not_called()


class JsonHttpClientStatusClassificationTest(unittest.TestCase):
    def test_retryable_status_codes(self):
        for code in (408, 429, 500, 502, 503, 504):
            self.assertIn(code, RETRYABLE_STATUS_CODES)

    def test_non_retryable_status_codes(self):
        for code in (400, 401, 403, 404, 409):
            self.assertNotIn(code, RETRYABLE_STATUS_CODES)


if __name__ == "__main__":
    unittest.main()
