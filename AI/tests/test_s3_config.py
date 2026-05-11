import sys
import unittest
from unittest.mock import Mock, patch

from app.core.config import S3ConfigurationError, load_s3_settings
from app.core.s3 import create_s3_client


class S3ConfigTest(unittest.TestCase):
    def test_load_s3_settings_uses_configured_buckets(self):
        settings = load_s3_settings(
            {
                "AWS_REGION": "ap-northeast-2",
                "APP_SCAN_RAW_S3_BUCKET": "raw-bucket",
                "APP_ANALYSIS_RESULT_S3_BUCKET": "analysis-bucket",
                "AWS_ACCESS_KEY_ID": "access-key",
                "AWS_SECRET_ACCESS_KEY": "secret-key",
            }
        )

        self.assertEqual(settings.region, "ap-northeast-2")
        self.assertEqual(settings.raw_scan_bucket, "raw-bucket")
        self.assertEqual(settings.analysis_result_bucket, "analysis-bucket")
        self.assertEqual(settings.access_key_id, "access-key")
        self.assertEqual(settings.secret_access_key, "secret-key")

    def test_load_s3_settings_allows_same_bucket_for_raw_and_analysis(self):
        settings = load_s3_settings(
            {
                "APP_SCAN_RAW_S3_BUCKET": "ssafer-bucket",
                "APP_ANALYSIS_RESULT_S3_BUCKET": "ssafer-bucket",
            }
        )

        self.assertEqual(settings.region, "ap-northeast-2")
        self.assertEqual(settings.raw_scan_bucket, "ssafer-bucket")
        self.assertEqual(settings.analysis_result_bucket, "ssafer-bucket")

    def test_load_s3_settings_rejects_missing_bucket(self):
        with self.assertRaisesRegex(S3ConfigurationError, "APP_SCAN_RAW_S3_BUCKET"):
            load_s3_settings({})

    def test_load_s3_settings_rejects_missing_analysis_bucket(self):
        with self.assertRaisesRegex(
            S3ConfigurationError, "APP_ANALYSIS_RESULT_S3_BUCKET"
        ):
            load_s3_settings({"APP_SCAN_RAW_S3_BUCKET": "raw-bucket"})

    def test_load_s3_settings_rejects_partial_credentials(self):
        with self.assertRaisesRegex(S3ConfigurationError, "must be set together"):
            load_s3_settings(
                {
                    "APP_SCAN_RAW_S3_BUCKET": "raw-bucket",
                    "APP_ANALYSIS_RESULT_S3_BUCKET": "analysis-bucket",
                    "AWS_ACCESS_KEY_ID": "access-key",
                }
            )

    def test_create_s3_client_passes_settings_to_boto3(self):
        boto3 = Mock()
        boto3.client.return_value = object()

        settings = load_s3_settings(
            {
                "AWS_REGION": "ap-northeast-2",
                "APP_SCAN_RAW_S3_BUCKET": "raw-bucket",
                "APP_ANALYSIS_RESULT_S3_BUCKET": "analysis-bucket",
                "AWS_ACCESS_KEY_ID": "access-key",
                "AWS_SECRET_ACCESS_KEY": "secret-key",
                "AWS_S3_ENDPOINT_URL": "http://localhost:4566",
            }
        )

        with patch.dict(sys.modules, {"boto3": boto3}):
            client = create_s3_client(settings)

        self.assertIs(client, boto3.client.return_value)
        boto3.client.assert_called_once_with(
            service_name="s3",
            region_name="ap-northeast-2",
            endpoint_url="http://localhost:4566",
            aws_access_key_id="access-key",
            aws_secret_access_key="secret-key",
        )


if __name__ == "__main__":
    unittest.main()
