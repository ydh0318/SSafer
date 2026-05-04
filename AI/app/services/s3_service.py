from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from app.core.config import S3Settings, load_s3_settings
from app.core.s3 import create_s3_client


class S3LocationError(ValueError):
    pass


class S3DownloadError(RuntimeError):
    pass


class S3UploadError(RuntimeError):
    pass


@dataclass(frozen=True)
class S3Location:
    bucket: str
    key: str


def parse_s3_uri(uri: str) -> S3Location:
    parsed = urlparse(uri)

    if parsed.scheme.lower() != "s3":
        raise S3LocationError("S3 URI must start with s3://.")

    bucket = parsed.netloc.strip()
    key = parsed.path.lstrip("/")

    if not bucket:
        raise S3LocationError("S3 URI bucket must not be empty.")

    if not key:
        raise S3LocationError("S3 URI key must not be empty.")

    return S3Location(bucket=bucket, key=key)


def resolve_raw_scan_location(
    object_key_or_uri: str,
    settings: S3Settings | None = None,
) -> S3Location:
    settings = settings or load_s3_settings()

    if object_key_or_uri.startswith("s3://"):
        return parse_s3_uri(object_key_or_uri)

    key = object_key_or_uri.lstrip("/")
    if not key:
        raise S3LocationError("S3 object key must not be empty.")

    return S3Location(bucket=settings.raw_scan_bucket, key=key)


def resolve_analysis_result_location(
    object_key_or_uri: str,
    settings: S3Settings | None = None,
) -> S3Location:
    settings = settings or load_s3_settings()

    if object_key_or_uri.startswith("s3://"):
        return parse_s3_uri(object_key_or_uri)

    key = object_key_or_uri.lstrip("/")
    if not key:
        raise S3LocationError("S3 object key must not be empty.")

    return S3Location(bucket=settings.analysis_result_bucket, key=key)


def download_scan_result_json(
    object_key_or_uri: str,
    destination_path: str,
    *,
    settings: S3Settings | None = None,
    s3_client: Any | None = None,
) -> Path:
    settings = settings or load_s3_settings()
    location = resolve_raw_scan_location(object_key_or_uri, settings)
    client = s3_client or create_s3_client(settings)

    destination = Path(destination_path)
    if not destination.is_absolute():
        destination = Path.cwd() / destination

    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        client.download_file(
            Bucket=location.bucket,
            Key=location.key,
            Filename=str(destination),
        )
    except Exception as exc:
        raise S3DownloadError(
            "Failed to download scan_result.json from S3: "
            f"s3://{location.bucket}/{location.key}"
        ) from exc

    return destination


def upload_analysis_result_json(
    source_path: str,
    object_key_or_uri: str,
    *,
    settings: S3Settings | None = None,
    s3_client: Any | None = None,
) -> str:
    settings = settings or load_s3_settings()
    location = resolve_analysis_result_location(object_key_or_uri, settings)
    client = s3_client or create_s3_client(settings)

    source = Path(source_path)
    if not source.is_absolute():
        source = Path.cwd() / source

    if not source.exists():
        raise S3UploadError(f"analysis_result.json file not found: {source}")

    try:
        client.upload_file(
            Filename=str(source),
            Bucket=location.bucket,
            Key=location.key,
            ExtraArgs={"ContentType": "application/json"},
        )
    except Exception as exc:
        raise S3UploadError(
            "Failed to upload analysis_result.json to S3: "
            f"s3://{location.bucket}/{location.key}"
        ) from exc

    return f"s3://{location.bucket}/{location.key}"
