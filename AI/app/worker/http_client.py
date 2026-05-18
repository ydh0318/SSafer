import json
import logging
import random
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


logger = logging.getLogger(__name__)

# 5xx + 408 (request timeout) + 429 (too many requests) are transient and
# benefit from a quick local retry. Other 4xx are permanent and propagate.
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


class JsonHttpClientError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        response_body: str | None = None,
        response_json: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body
        self.response_json = response_json


class JsonHttpClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout_seconds: int,
        default_headers: dict[str, str] | None = None,
        max_retries: int = 0,
        retry_backoff_seconds: float = 1.0,
        retry_backoff_max_seconds: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.default_headers = default_headers or {}
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds
        self.retry_backoff_max_seconds = retry_backoff_max_seconds

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._send_json("POST", path, payload)

    def patch_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._send_json("PATCH", path, payload)

    def _send_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            **self.default_headers,
        }

        for attempt_index in range(self.max_retries + 1):
            if attempt_index > 0:
                delay = self._compute_backoff(attempt_index)
                logger.info(
                    "Retrying HTTP request after %.2fs (attempt %d/%d) %s %s",
                    delay,
                    attempt_index + 1,
                    self.max_retries + 1,
                    method,
                    url,
                )
                time.sleep(delay)

            request = Request(url, data=body, headers=headers, method=method)
            try:
                response_body = self._attempt_request(request, method, url)
            except JsonHttpClientError as exc:
                if self._is_retryable(exc) and attempt_index < self.max_retries:
                    continue
                raise
            return self._decode_response(response_body, method, url)

        # Defensive — loop always either returns or raises.
        raise JsonHttpClientError(f"{method} {url} retry loop exited unexpectedly.")

    def _attempt_request(self, request: Request, method: str, url: str) -> bytes:
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                return response.read()
        except HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="replace")
            response_json: dict[str, Any] | None = None
            try:
                decoded = json.loads(response_body)
                if isinstance(decoded, dict):
                    response_json = decoded
            except json.JSONDecodeError:
                pass
            raise JsonHttpClientError(
                f"{method} {url} failed with HTTP {exc.code}: {response_body}",
                status_code=exc.code,
                response_body=response_body,
                response_json=response_json,
            ) from exc
        except URLError as exc:
            raise JsonHttpClientError(
                f"{method} {url} failed: {exc.reason}"
            ) from exc

    def _decode_response(
        self,
        response_body: bytes,
        method: str,
        url: str,
    ) -> dict[str, Any]:
        if not response_body:
            return {}

        try:
            decoded = json.loads(response_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise JsonHttpClientError(f"{method} {url} returned invalid JSON.") from exc

        if not isinstance(decoded, dict):
            raise JsonHttpClientError(f"{method} {url} response must be a JSON object.")

        return decoded

    def _is_retryable(self, exc: JsonHttpClientError) -> bool:
        if exc.status_code is None:
            # Network-level failure (URLError, timeout). Always retry.
            return True
        return exc.status_code in RETRYABLE_STATUS_CODES

    def _compute_backoff(self, attempt_index: int) -> float:
        """Exponential backoff with jitter, capped at retry_backoff_max_seconds.

        attempt_index >= 1. First retry waits `retry_backoff_seconds`, second
        waits 2x, and so on (capped).
        """
        base = self.retry_backoff_seconds * (2 ** (attempt_index - 1))
        base = min(base, self.retry_backoff_max_seconds)
        jitter = random.uniform(0.5, 1.5)
        return base * jitter
