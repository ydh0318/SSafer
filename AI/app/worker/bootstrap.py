"""Worker startup wiring and per-message decision helpers.

Shared by app.worker.async_consumer (the production entry point). Provides:

- build_processor(): factory that wires up Spring/FastAPI HTTP clients and
  returns a ScanTaskProcessor configured from environment.
- should_requeue_exception(): classifies whether a failure should be
  re-queued by the broker. 4xx responses Spring/FastAPI consider permanent
  (NON_REQUEUE_HTTP_STATUS_CODES) are dropped; everything else is retried.
"""

from app.worker.config import load_worker_settings
from app.worker.fastapi_client import FastApiClient
from app.worker.http_client import JsonHttpClient, JsonHttpClientError
from app.worker.processor import ScanTaskProcessor
from app.worker.spring_client import SpringClient


NON_REQUEUE_HTTP_STATUS_CODES = {400, 401, 403, 404, 409}


def should_requeue_exception(exc: Exception) -> bool:
    if isinstance(exc, JsonHttpClientError):
        if exc.status_code in NON_REQUEUE_HTTP_STATUS_CODES:
            return False
        return True
    return True


def build_processor() -> ScanTaskProcessor:
    settings = load_worker_settings()
    spring_headers: dict[str, str] = {}
    if settings.spring_api_secret is not None:
        spring_headers["X-Worker-Secret"] = settings.spring_api_secret

    spring_client = SpringClient(
        JsonHttpClient(
            base_url=settings.spring_base_url,
            timeout_seconds=settings.http_timeout_seconds,
            default_headers=spring_headers,
            max_retries=settings.http_max_retries,
            retry_backoff_seconds=settings.http_retry_backoff_seconds,
            retry_backoff_max_seconds=settings.http_retry_backoff_max_seconds,
        )
    )
    fastapi_client = FastApiClient(
        JsonHttpClient(
            base_url=settings.fastapi_base_url,
            timeout_seconds=settings.http_timeout_seconds,
            max_retries=settings.http_max_retries,
            retry_backoff_seconds=settings.http_retry_backoff_seconds,
            retry_backoff_max_seconds=settings.http_retry_backoff_max_seconds,
        )
    )
    return ScanTaskProcessor(
        spring_client=spring_client,
        fastapi_client=fastapi_client,
        settings=settings,
    )
