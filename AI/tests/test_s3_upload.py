import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from app.core.config import S3Settings
from app.services.s3_service import (
    S3UploadError,
    resolve_analysis_result_location,
    upload_analysis_result_json,
)


def build_settings() -> S3Settings:
    return S3Settings(
        region="ap-northeast-2",
        raw_scan_bucket="raw-bucket",
        analysis_result_bucket="analysis-bucket",
    )


class S3UploadTest(unittest.TestCase):
    def test_resolve_analysis_result_location_uses_default_analysis_bucket(self):
        location = resolve_analysis_result_location(
            "analysis/1/analysis_result.json",
            build_settings(),
        )

        self.assertEqual(location.bucket, "analysis-bucket")
        self.assertEqual(location.key, "analysis/1/analysis_result.json")

    def test_resolve_analysis_result_location_accepts_full_s3_uri(self):
        location = resolve_analysis_result_location(
            "s3://other-bucket/analysis/1/analysis_result.json",
            build_settings(),
        )

        self.assertEqual(location.bucket, "other-bucket")
        self.assertEqual(location.key, "analysis/1/analysis_result.json")

    def test_upload_analysis_result_json_uploads_file(self):
        client = Mock()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "analysis_result.json"
            source.write_text('{"resultCount": 0}', encoding="utf-8")

            s3_uri = upload_analysis_result_json(
                str(source),
                "analysis/1/analysis_result.json",
                settings=build_settings(),
                s3_client=client,
            )

        self.assertEqual(s3_uri, "s3://analysis-bucket/analysis/1/analysis_result.json")
        client.upload_file.assert_called_once_with(
            Filename=str(source),
            Bucket="analysis-bucket",
            Key="analysis/1/analysis_result.json",
            ExtraArgs={"ContentType": "application/json"},
        )

    def test_upload_analysis_result_json_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_path = Path(temp_dir) / "missing.json"

            with self.assertRaisesRegex(S3UploadError, "file not found"):
                upload_analysis_result_json(
                    str(missing_path),
                    "analysis/1/analysis_result.json",
                    settings=build_settings(),
                    s3_client=Mock(),
                )

    def test_upload_analysis_result_json_wraps_s3_error(self):
        client = Mock()
        client.upload_file.side_effect = RuntimeError("access denied")

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "analysis_result.json"
            source.write_text('{"resultCount": 0}', encoding="utf-8")

            with self.assertRaisesRegex(S3UploadError, "Failed to upload"):
                upload_analysis_result_json(
                    str(source),
                    "analysis/1/analysis_result.json",
                    settings=build_settings(),
                    s3_client=client,
                )


if __name__ == "__main__":
    unittest.main()
