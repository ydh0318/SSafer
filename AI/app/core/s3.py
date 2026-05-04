from typing import Any

from app.core.config import S3Settings, load_s3_settings


def create_s3_client(settings: S3Settings | None = None) -> Any:
    settings = settings or load_s3_settings()

    import boto3

    client_kwargs: dict[str, Any] = {
        "service_name": "s3",
        "region_name": settings.region,
    }

    if settings.endpoint_url is not None:
        client_kwargs["endpoint_url"] = settings.endpoint_url

    if settings.access_key_id is not None and settings.secret_access_key is not None:
        client_kwargs["aws_access_key_id"] = settings.access_key_id
        client_kwargs["aws_secret_access_key"] = settings.secret_access_key

    return boto3.client(**client_kwargs)
