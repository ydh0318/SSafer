import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.services.result_service import load_analysis_result
from app.services.s3_service import (
    S3OperationError,
    download_scan_result_json,
    upload_analysis_result_json,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a real S3 integration smoke test.")
    parser.add_argument(
        "--download-key",
        default="ai-test/connection-test.txt",
        help="S3 object key or s3:// URI to download.",
    )
    parser.add_argument(
        "--download-destination",
        default="data/s3_download_test.txt",
        help="Local path where the downloaded object is saved.",
    )
    parser.add_argument(
        "--upload-source",
        default="data/analysis_result.json",
        help="Local analysis_result.json path to upload.",
    )
    parser.add_argument(
        "--upload-key",
        default="ai-test/analysis_result.integration_test.json",
        help="S3 object key or s3:// URI to upload analysis_result.json.",
    )
    parser.add_argument(
        "--verify-upload",
        action="store_true",
        help="Download the uploaded analysis_result.json and validate its schema.",
    )
    args = parser.parse_args()

    try:
        downloaded_path = download_scan_result_json(
            args.download_key,
            args.download_destination,
        )
        print(f"download ok: {downloaded_path}")

        s3_uri = upload_analysis_result_json(args.upload_source, args.upload_key)
        print(f"upload ok: {s3_uri}")

        if args.verify_upload:
            verification_path = Path("data/analysis_result.s3_verify.json")
            downloaded_analysis_result = download_scan_result_json(
                s3_uri,
                str(verification_path),
            )
            result = load_analysis_result(str(downloaded_analysis_result))
            print(f"verify ok: resultCount={result['resultCount']}")
    except S3OperationError as exc:
        print(
            "s3 error: "
            f"operation={exc.operation} "
            f"error_code={exc.error_code} "
            f"s3_uri={exc.s3_uri} "
            f"message={exc}"
        )
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
