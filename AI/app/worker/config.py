import os
from dataclasses import dataclass
from typing import Mapping


def _get_optional_env(env: Mapping[str, str], key: str) -> str | None:
    value = env.get(key)
    if value is None or not value.strip():
        return None
    return value.strip()


def _get_int_env(env: Mapping[str, str], key: str, default: int) -> int:
    value = _get_optional_env(env, key)
    if value is None:
        return default
    return int(value)


def _get_positive_int_env(env: Mapping[str, str], key: str, default: int) -> int:
    value = _get_int_env(env, key, default)
    if value < 1:
        raise ValueError(f"{key} must be greater than or equal to 1.")
    return value


def _get_nonnegative_int_env(env: Mapping[str, str], key: str, default: int) -> int:
    value = _get_int_env(env, key, default)
    if value < 0:
        raise ValueError(f"{key} must be greater than or equal to 0.")
    return value


def _get_positive_float_env(
    env: Mapping[str, str], key: str, default: float
) -> float:
    raw = _get_optional_env(env, key)
    if raw is None:
        return default
    value = float(raw)
    if value <= 0:
        raise ValueError(f"{key} must be greater than 0.")
    return value


@dataclass(frozen=True)
class WorkerSettings:
    rabbitmq_host: str
    rabbitmq_port: int
    rabbitmq_username: str
    rabbitmq_password: str
    rabbitmq_virtual_host: str
    scan_request_queue: str
    fastapi_base_url: str
    spring_base_url: str
    spring_api_secret: str | None
    analysis_result_bucket: str | None
    analysis_result_prefix: str
    http_timeout_seconds: int
    max_concurrency: int
    shutdown_timeout_seconds: int
    redelivery_cap: int
    http_max_retries: int
    http_retry_backoff_seconds: float
    http_retry_backoff_max_seconds: float


def load_worker_settings(env: Mapping[str, str] | None = None) -> WorkerSettings:
    env = env or os.environ

    return WorkerSettings(
        rabbitmq_host=_get_optional_env(env, "RABBITMQ_HOST") or "localhost",
        rabbitmq_port=_get_int_env(env, "RABBITMQ_PORT", 5672),
        rabbitmq_username=_get_optional_env(env, "RABBITMQ_USERNAME") or "guest",
        rabbitmq_password=_get_optional_env(env, "RABBITMQ_PASSWORD") or "guest",
        rabbitmq_virtual_host=_get_optional_env(env, "RABBITMQ_VIRTUAL_HOST") or "/",
        scan_request_queue=(
            _get_optional_env(env, "AGENT_TASK_SCAN_REQUEST_QUEUE")
            or "ssafer.agent.scan.request"
        ),
        fastapi_base_url=_get_optional_env(env, "FASTAPI_BASE_URL")
        or "http://127.0.0.1:8000",
        spring_base_url=_get_optional_env(env, "SPRING_BASE_URL")
        or "http://127.0.0.1:8080",
        spring_api_secret=_get_optional_env(env, "SPRING_API_SECRET"),
        analysis_result_bucket=_get_optional_env(env, "APP_ANALYSIS_RESULT_S3_BUCKET"),
        analysis_result_prefix=(
            _get_optional_env(env, "WORKER_ANALYSIS_RESULT_PREFIX") or "analysis"
        ),
        http_timeout_seconds=_get_int_env(env, "WORKER_HTTP_TIMEOUT_SECONDS", 120),
        max_concurrency=_get_positive_int_env(env, "WORKER_MAX_CONCURRENCY", 5),
        shutdown_timeout_seconds=_get_positive_int_env(
            env, "WORKER_SHUTDOWN_TIMEOUT_SECONDS", 1800
        ),
        redelivery_cap=_get_positive_int_env(env, "WORKER_REDELIVERY_CAP", 5),
        http_max_retries=_get_nonnegative_int_env(env, "WORKER_HTTP_MAX_RETRIES", 2),
        http_retry_backoff_seconds=_get_positive_float_env(
            env, "WORKER_HTTP_RETRY_BACKOFF_SECONDS", 1.0
        ),
        http_retry_backoff_max_seconds=_get_positive_float_env(
            env, "WORKER_HTTP_RETRY_BACKOFF_MAX_SECONDS", 30.0
        ),
    )
