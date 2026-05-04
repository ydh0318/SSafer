import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from app.core.config import S3Settings
from app.services.s3_service import (
    S3DownloadError,
    S3LocationError,
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

    def test_download_scan_result_json_wraps_s3_error(self):
        client = Mock()
        client.download_file.side_effect = RuntimeError("access denied")

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(S3DownloadError, "Failed to download"):
                download_scan_result_json(
                    "scans/1/scan_result.json",
                    str(Path(temp_dir) / "scan_result.json"),
                    settings=build_settings(),
                    s3_client=client,
                )


if __name__ == "__main__":
    unittest.main()
