import os
from dataclasses import dataclass
from typing import Mapping


def _get_int_env(key: str, default: int) -> int:
    value = os.getenv(key)
    if value is None or not value.strip():
        return default
    return int(value)


def _get_float_env(key: str, default: float) -> float:
    value = os.getenv(key)
    if value is None or not value.strip():
        return default
    return float(value)


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_TEMPERATURE = _get_float_env("OLLAMA_TEMPERATURE", 0.1)
OLLAMA_TIMEOUT_SECONDS = _get_float_env("OLLAMA_TIMEOUT_SECONDS", 600.0)
OLLAMA_MAX_RETRIES = _get_int_env("OLLAMA_MAX_RETRIES", 2)
OLLAMA_RETRY_BACKOFF_SECONDS = _get_float_env(
    "OLLAMA_RETRY_BACKOFF_SECONDS",
    1.0,
)
S3_MAX_RETRIES = _get_int_env("S3_MAX_RETRIES", 2)
S3_RETRY_BACKOFF_SECONDS = _get_float_env("S3_RETRY_BACKOFF_SECONDS", 1.0)


class S3ConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class S3Settings:
    region: str
    raw_scan_bucket: str
    analysis_result_bucket: str
    access_key_id: str | None = None
    secret_access_key: str | None = None
    endpoint_url: str | None = None


def _get_optional_env(env: Mapping[str, str], key: str) -> str | None:
    value = env.get(key)
    if value is None or not value.strip():
        return None
    return value.strip()


def load_s3_settings(env: Mapping[str, str] | None = None) -> S3Settings:
    env = env or os.environ

    region = _get_optional_env(env, "AWS_REGION") or "ap-northeast-2"
    default_bucket = _get_optional_env(env, "AWS_S3_BUCKET")
    raw_scan_bucket = (
        _get_optional_env(env, "APP_SCAN_RESULT_S3_BUCKET")
        or _get_optional_env(env, "APP_SCAN_RAW_S3_BUCKET")
        or default_bucket
    )
    analysis_result_bucket = (
        _get_optional_env(env, "APP_ANALYSIS_RESULT_S3_BUCKET") or default_bucket
    )
    access_key_id = _get_optional_env(env, "AWS_ACCESS_KEY_ID")
    secret_access_key = _get_optional_env(env, "AWS_SECRET_ACCESS_KEY")
    endpoint_url = _get_optional_env(env, "AWS_S3_ENDPOINT_URL")

    if raw_scan_bucket is None:
        raise S3ConfigurationError(
            "APP_SCAN_RESULT_S3_BUCKET or AWS_S3_BUCKET must be set."
        )

    if analysis_result_bucket is None:
        raise S3ConfigurationError(
            "APP_ANALYSIS_RESULT_S3_BUCKET or AWS_S3_BUCKET must be set."
        )

    if bool(access_key_id) != bool(secret_access_key):
        raise S3ConfigurationError(
            "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together."
        )

    return S3Settings(
        region=region,
        raw_scan_bucket=raw_scan_bucket,
        analysis_result_bucket=analysis_result_bucket,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        endpoint_url=endpoint_url,
    )
