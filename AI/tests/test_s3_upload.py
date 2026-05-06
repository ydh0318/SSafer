import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

from app.core.config import S3Settings
from app.services.s3_service import (
    S3UploadError,
    resolve_analysis_result_location,
    upload_analysis_result_json_data,
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

    def test_upload_analysis_result_json_data_uploads_without_local_file(self):
        client = Mock()

        s3_uri = upload_analysis_result_json_data(
            {"schemaVersion": "0.1", "resultCount": 0, "results": []},
            "analysis/1/analysis_result.json",
            settings=build_settings(),
            s3_client=client,
        )

        self.assertEqual(s3_uri, "s3://analysis-bucket/analysis/1/analysis_result.json")
        client.put_object.assert_called_once()
        call_args = client.put_object.call_args.kwargs
        self.assertEqual(call_args["Bucket"], "analysis-bucket")
        self.assertEqual(call_args["Key"], "analysis/1/analysis_result.json")
        self.assertEqual(call_args["ContentType"], "application/json")
        self.assertIn(b'"resultCount": 0', call_args["Body"])

    def test_upload_analysis_result_json_data_retries_transient_error(self):
        client = Mock()
        client.put_object.side_effect = [RuntimeError("temporary network error"), None]

        with patch("app.services.s3_service.S3_RETRY_BACKOFF_SECONDS", 0):
            s3_uri = upload_analysis_result_json_data(
                {"schemaVersion": "0.1", "resultCount": 0, "results": []},
                "analysis/1/analysis_result.json",
                settings=build_settings(),
                s3_client=client,
            )

        self.assertEqual(s3_uri, "s3://analysis-bucket/analysis/1/analysis_result.json")
        self.assertEqual(client.put_object.call_count, 2)

    def test_upload_analysis_result_json_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_path = Path(temp_dir) / "missing.json"

            with self.assertRaisesRegex(S3UploadError, "file not found") as context:
                upload_analysis_result_json(
                    str(missing_path),
                    "analysis/1/analysis_result.json",
                    settings=build_settings(),
                    s3_client=Mock(),
                )

        self.assertEqual(context.exception.operation, "upload")
        self.assertEqual(context.exception.error_code, "LOCAL_FILE_NOT_FOUND")
        self.assertEqual(context.exception.attempts, 0)
        self.assertEqual(
            context.exception.s3_uri,
            "s3://analysis-bucket/analysis/1/analysis_result.json",
        )

    def test_upload_analysis_result_json_wraps_s3_error(self):
        client = Mock()
        client.upload_file.side_effect = ClientError(
            {
                "Error": {
                    "Code": "NoSuchBucket",
                    "Message": "Bucket does not exist",
                }
            },
            "PutObject",
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "analysis_result.json"
            source.write_text('{"resultCount": 0}', encoding="utf-8")

            with self.assertRaisesRegex(S3UploadError, "NoSuchBucket") as context:
                upload_analysis_result_json(
                    str(source),
                    "analysis/1/analysis_result.json",
                    settings=build_settings(),
                    s3_client=client,
                )

        self.assertEqual(context.exception.operation, "upload")
        self.assertEqual(context.exception.bucket, "analysis-bucket")
        self.assertEqual(context.exception.key, "analysis/1/analysis_result.json")
        self.assertEqual(context.exception.error_code, "NoSuchBucket")
        self.assertEqual(context.exception.attempts, 1)


if __name__ == "__main__":
    unittest.main()
