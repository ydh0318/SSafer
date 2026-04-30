import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from security_samples import scan_payload_with_trivy_secret, sanitized_scan_payload_with_trivy_secret
from ssafer.core import upload


def _write_scan(project_root: Path, scan: dict[str, Any]) -> None:
    results_dir = project_root / ".ssafer" / "results"
    results_dir.mkdir(parents=True)
    scan_path = results_dir / "local-scan-test.json"
    scan_path.write_text(json.dumps(scan), encoding="utf-8")
    (results_dir / "last_scan.txt").write_text(scan_path.name, encoding="utf-8")


def test_upload_last_scan_registers_uploads_to_s3_and_reports_completion(tmp_path: Path, monkeypatch):
    scan = {"scanId": "local-scan-test", "projectName": "sample-app", "artifacts": []}
    _write_scan(tmp_path, scan)
    calls: list[tuple[str, str, Any]] = []

    class FakeClient:
        def __init__(self, timeout: int):
            assert timeout == 30

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            calls.append(("POST", url, json))
            request = httpx.Request("POST", url)
            if url.endswith("/api/v1/scans"):
                return httpx.Response(
                    201,
                    json={
                        "message": "created",
                        "data": {
                            "scanId": 1001,
                            "projectId": 2001,
                            "status": "REQUESTED",
                            "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
                            "rawUploadUrl": "https://s3.example.com/upload",
                        },
                    },
                    request=request,
                )
            return httpx.Response(
                200,
                json={
                    "scanId": 1001,
                    "projectId": 2001,
                    "status": "RAW_UPLOADED",
                    "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
                },
                request=request,
            )

        def put(self, url: str, content: bytes, headers: dict | None = None):
            calls.append(("PUT", url, json.loads(content.decode("utf-8"))))
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_last_scan(tmp_path, api_url="http://backend.test/")

    assert response == {
        "scanId": 1001,
        "projectId": 2001,
        "status": "RAW_UPLOADED",
        "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
    }
    assert calls == [
        (
            "POST",
            "http://backend.test/api/v1/scans",
            {
                "projectName": "sample-app",
                "source": "CLI",
                "scanName": "local-scan-test",
                "targetPath": str(tmp_path),
                "includeLogs": False,
            },
        ),
        ("PUT", "https://s3.example.com/upload", scan),
        (
            "POST",
            "http://backend.test/api/v1/internal/scans/1001/raw-results",
            {
                "status": "RAW_UPLOADED",
                "progressStep": "uploaded",
                "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
            },
        ),
    ]


def test_upload_last_scan_uses_default_api_url(tmp_path: Path, monkeypatch):
    scan = {"scanId": "local-scan-test", "artifacts": []}
    _write_scan(tmp_path, scan)
    posted_urls: list[str] = []

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            posted_urls.append(url)
            request = httpx.Request("POST", url)
            if url.endswith("/api/v1/scans"):
                return httpx.Response(
                    201,
                    json={
                        "data": {
                            "scanId": 1001,
                            "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
                            "rawUploadUrl": "https://s3.example.com/upload",
                        }
                    },
                    request=request,
                )
            return httpx.Response(200, json={"scanId": 1001}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    upload.upload_last_scan(tmp_path)

    assert posted_urls == [
        "http://localhost:8080/api/v1/scans",
        "http://localhost:8080/api/v1/internal/scans/1001/raw-results",
    ]


def test_upload_last_scan_uses_project_config_endpoint(tmp_path: Path, monkeypatch):
    scan = {"scanId": "local-scan-test", "artifacts": []}
    _write_scan(tmp_path, scan)
    (tmp_path / "ssafer.yml").write_text(
        """
upload:
  endpoint: https://api.ssafer.dev
""",
        encoding="utf-8",
    )
    posted_urls: list[str] = []

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            posted_urls.append(url)
            request = httpx.Request("POST", url)
            if url.endswith("/api/v1/scans"):
                return httpx.Response(
                    201,
                    json={
                        "data": {
                            "scanId": 1001,
                            "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
                            "rawUploadUrl": "https://s3.example.com/upload",
                        }
                    },
                    request=request,
                )
            return httpx.Response(200, json={"scanId": 1001}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    upload.upload_last_scan(tmp_path)

    assert posted_urls == [
        "https://api.ssafer.dev/api/v1/scans",
        "https://api.ssafer.dev/api/v1/internal/scans/1001/raw-results",
    ]


def test_upload_last_scan_requires_existing_scan(tmp_path: Path):
    with pytest.raises(RuntimeError, match="No local scan package found"):
        upload.upload_last_scan(tmp_path)


def test_upload_last_scan_blocks_unmasked_secret_before_backend_or_s3_requests(tmp_path: Path, monkeypatch):
    scan = {
        "scanId": "local-scan-test",
        "artifacts": [
            {
                "type": "trivy-json",
                "content": {
                    "Results": [
                        {
                            "Secrets": [
                                {
                                    "RuleID": "aws-access-key-id",
                                    "Match": "AKIAIOSFODNN7EXAMPLE",
                                }
                            ]
                        }
                    ]
                },
            }
        ],
    }
    _write_scan(tmp_path, scan)

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            raise AssertionError("upload request should be blocked before HTTP post")

        def put(self, url: str, content: bytes, headers: dict | None = None):
            raise AssertionError("S3 upload should be blocked before HTTP put")

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    with pytest.raises(RuntimeError) as exc_info:
        upload.upload_last_scan(tmp_path)

    message = str(exc_info.value)
    assert "Upload blocked" in message
    assert "$.artifacts[0].content.Results[0].Secrets[0].Match" in message


def test_find_unmasked_secret_paths_ignores_masked_values_and_metadata():
    payload = {
        "scanId": "local-scan-test",
        "hash": "sha256:abc123",
        "findings": [
            {
                "ruleId": "AWS_ACCESS_KEY",
                "title": "AWS Access Key",
                "maskedEvidence": "***MASKED***",
            }
        ],
        "artifacts": [{"content": {"PASSWORD": "***MASKED***"}}],
    }

    assert upload.find_unmasked_secret_paths(payload) == []


def test_find_unmasked_secret_paths_reports_secret_key_values():
    payload = {
        "artifacts": [
            {
                "content": {
                    "database": {
                        "password": "plain-db-password",
                    }
                }
            }
        ]
    }

    assert upload.find_unmasked_secret_paths(payload) == [
        "$.artifacts[0].content.database.password"
    ]


def test_find_unmasked_secret_paths_reports_private_key_blocks():
    payload = {
        "artifacts": [
            {
                "content": {
                    "config": "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
                }
            }
        ]
    }

    assert upload.find_unmasked_secret_paths(payload) == [
        "$.artifacts[0].content.config"
    ]


def test_find_unmasked_secret_paths_reports_token_values():
    payload = {
        "findings": [
            {
                "maskedEvidence": {
                    "token": "plain-api-token",
                }
            }
        ]
    }

    assert upload.find_unmasked_secret_paths(payload) == [
        "$.findings[0].maskedEvidence.token"
    ]


def test_find_unmasked_secret_paths_ignores_masked_trivy_secret_match():
    payload = {
        "artifacts": [
            {
                "content": {
                    "Results": [
                        {
                            "Secrets": [
                                {
                                    "RuleID": "aws-access-key-id",
                                    "Match": "***MASKED***",
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    assert upload.find_unmasked_secret_paths(payload) == []


def test_find_unmasked_secret_paths_ignores_placeholder_secret_values():
    payload = {
        "artifacts": [
            {
                "content": {
                    "api_key": "your_api_key_here",
                    "password": "${DB_PASSWORD}",
                    "token": "replace_me",
                }
            }
        ]
    }

    assert upload.find_unmasked_secret_paths(payload) == []


def test_upload_guard_validates_raw_and_sanitized_scan_payload_pair():
    raw_payload = scan_payload_with_trivy_secret()
    sanitized_payload = sanitized_scan_payload_with_trivy_secret()

    assert upload.find_unmasked_secret_paths(raw_payload) == [
        "$.findings[0].maskedEvidence",
        "$.artifacts[0].content.Results[0].Secrets[0].Match",
    ]
    assert upload.find_unmasked_secret_paths(sanitized_payload) == []


def test_upload_last_scan_allows_sanitized_scan_payload(tmp_path: Path, monkeypatch):
    scan = sanitized_scan_payload_with_trivy_secret()
    _write_scan(tmp_path, scan)
    calls: list[tuple[str, str, Any]] = []

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            calls.append(("POST", url, json))
            request = httpx.Request("POST", url)
            if url.endswith("/api/v1/scans"):
                return httpx.Response(
                    201,
                    json={
                        "data": {
                            "scanId": 1001,
                            "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
                            "rawUploadUrl": "https://s3.example.com/upload",
                        }
                    },
                    request=request,
                )
            return httpx.Response(200, json={"scanId": 1001}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            calls.append(("PUT", url, json.loads(content.decode("utf-8"))))
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    upload.upload_last_scan(tmp_path, api_url="http://backend.test")

    assert calls == [
        (
            "POST",
            "http://backend.test/api/v1/scans",
            {
                "projectName": tmp_path.name,
                "source": "CLI",
                "scanName": "local-scan-test",
                "targetPath": str(tmp_path),
                "includeLogs": False,
            },
        ),
        ("PUT", "https://s3.example.com/upload", scan),
        (
            "POST",
            "http://backend.test/api/v1/internal/scans/1001/raw-results",
            {
                "status": "RAW_UPLOADED",
                "progressStep": "uploaded",
                "rawResultPath": "s3://ssafer/raw/1001/upload/scan_result.json",
            },
        ),
    ]
