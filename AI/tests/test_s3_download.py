import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

from app.core.config import S3Settings
from app.services.s3_service import (
    S3DownloadError,
    S3LocationError,
    download_scan_result_json_data,
    download_scan_result_json,
    parse_s3_uri,
    resolve_raw_scan_location,
)


def build_settings() -> S3Settings:
    return S3Settings(
        region="ap-northeast-2",
        raw_scan_bucket="raw-bucket",
        analysis_result_bucket="analysis-bucket",
    )


class S3DownloadTest(unittest.TestCase):
    def test_parse_s3_uri(self):
        location = parse_s3_uri("s3://raw-bucket/scans/1/scan_result.json")

        self.assertEqual(location.bucket, "raw-bucket")
        self.assertEqual(location.key, "scans/1/scan_result.json")

    def test_parse_s3_uri_rejects_invalid_uri(self):
        with self.assertRaisesRegex(S3LocationError, "s3://"):
            parse_s3_uri("https://example.com/scan_result.json")

        with self.assertRaisesRegex(S3LocationError, "bucket"):
            parse_s3_uri("s3:///scan_result.json")

        with self.assertRaisesRegex(S3LocationError, "key"):
            parse_s3_uri("s3://raw-bucket")

    def test_resolve_raw_scan_location_uses_default_raw_bucket_for_key(self):
        location = resolve_raw_scan_location(
            "scans/1/scan_result.json",
            build_settings(),
        )

        self.assertEqual(location.bucket, "raw-bucket")
        self.assertEqual(location.key, "scans/1/scan_result.json")

    def test_resolve_raw_scan_location_accepts_full_s3_uri(self):
        location = resolve_raw_scan_location(
            "s3://other-bucket/scans/1/scan_result.json",
            build_settings(),
        )

        self.assertEqual(location.bucket, "other-bucket")
        self.assertEqual(location.key, "scans/1/scan_result.json")

    def test_download_scan_result_json_downloads_to_destination(self):
        client = Mock()

        with tempfile.TemporaryDirectory() as temp_dir:
            destination = Path(temp_dir) / "nested" / "scan_result.json"
            saved_path = download_scan_result_json(
                "scans/1/scan_result.json",
                str(destination),
                settings=build_settings(),
                s3_client=client,
            )

        self.assertEqual(saved_path, destination)
        client.download_file.assert_called_once_with(
            Bucket="raw-bucket",
            Key="scans/1/scan_result.json",
            Filename=str(destination),
        )

    def test_download_scan_result_json_data_reads_json_without_local_file(self):
        client = Mock()
        client.get_object.return_value = {
            "Body": BytesIO(
                b'{"schemaVersion":"0.1","scanId":"a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd","source":"cli","scannedAt":"2026-04-27T00:26:05Z","analysisStatus":"SUCCESS","findings":[]}'
            )
        }

        data = download_scan_result_json_data(
            "scans/1/scan_result.json",
            settings=build_settings(),
            s3_client=client,
        )

        self.assertEqual(data["schemaVersion"], "0.1")
        self.assertEqual(data["source"], "cli")
        client.get_object.assert_called_once_with(
            Bucket="raw-bucket",
            Key="scans/1/scan_result.json",
        )

    def test_download_scan_result_json_data_retries_transient_error(self):
        client = Mock()
        client.get_object.side_effect = [
            RuntimeError("temporary network error"),
            {
                "Body": BytesIO(
                    b'{"schemaVersion":"0.1","scanId":"a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd","source":"cli","scannedAt":"2026-04-27T00:26:05Z","analysisStatus":"SUCCESS","findings":[]}'
                )
            },
        ]

        with patch("app.services.s3_service.S3_RETRY_BACKOFF_SECONDS", 0):
            data = download_scan_result_json_data(
                "scans/1/scan_result.json",
                settings=build_settings(),
                s3_client=client,
            )

        self.assertEqual(data["schemaVersion"], "0.1")
        self.assertEqual(client.get_object.call_count, 2)

    def test_download_scan_result_json_wraps_s3_error(self):
        client = Mock()
        client.download_file.side_effect = ClientError(
            {
                "Error": {
                    "Code": "AccessDenied",
                    "Message": "Access denied",
                }
            },
            "GetObject",
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(S3DownloadError, "AccessDenied") as context:
                download_scan_result_json(
                    "scans/1/scan_result.json",
                    str(Path(temp_dir) / "scan_result.json"),
                    settings=build_settings(),
                    s3_client=client,
                )

        self.assertEqual(context.exception.operation, "download")
        self.assertEqual(context.exception.bucket, "raw-bucket")
        self.assertEqual(context.exception.key, "scans/1/scan_result.json")
        self.assertEqual(context.exception.error_code, "AccessDenied")
        self.assertEqual(context.exception.attempts, 1)
        self.assertEqual(
            context.exception.s3_uri,
            "s3://raw-bucket/scans/1/scan_result.json",
        )


if __name__ == "__main__":
    unittest.main()
