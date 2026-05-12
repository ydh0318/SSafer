import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from typer.testing import CliRunner

from security_samples import scan_payload_with_trivy_secret, sanitized_scan_payload_with_trivy_secret
import ssafer.main as main_module
from ssafer.core import upload
from ssafer.main import app


def _write_scan(project_root: Path, scan: dict[str, Any]) -> None:
    results_dir = project_root / ".ssafer" / "results"
    results_dir.mkdir(parents=True)
    scan_path = results_dir / "local-scan-test.json"
    scan_path.write_text(json.dumps(scan), encoding="utf-8")
    (results_dir / "last_scan.txt").write_text(scan_path.name, encoding="utf-8")


def _write_server_audit(project_root: Path, audit: dict[str, Any]) -> None:
    results_dir = project_root / ".ssafer" / "server-audit"
    results_dir.mkdir(parents=True)
    audit_path = results_dir / "local-server-audit.json"
    audit_path.write_text(json.dumps(audit), encoding="utf-8")
    (results_dir / "last_audit.txt").write_text(audit_path.name, encoding="utf-8")


def test_upload_last_scan_registers_uploads_to_s3_and_reports_completion(tmp_path: Path, monkeypatch):
    scan = {
        "scanId": "local-scan-test",
        "projectName": "sample-app",
        "artifacts": [],
        "findings": [{"id": "FND-0001"}, {"id": "FND-0002"}],
    }
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
                "scanName": "SSAfer CLI scan local-scan-test",
                "targetPath": str(tmp_path),
                "includeLogs": False,
            },
        ),
        ("PUT", "https://s3.example.com/upload", scan),
        (
            "POST",
            "http://backend.test/api/v1/scans/1001/raw-results",
            {
                "tool": "ssafer-cli",
                "toolVersion": upload.__version__,
                "resultCount": 2,
                "payloadHash": upload._payload_hash(upload._scan_json_bytes(scan)),
            },
        ),
    ]


def test_upload_last_scan_redirect_keeps_post_method(tmp_path: Path, monkeypatch):
    scan = {
        "scanId": "local-scan-test",
        "projectName": "sample-app",
        "artifacts": [],
        "findings": [{"id": "FND-0001"}],
    }
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
            if url == "http://backend.test/api/v1/scans":
                return httpx.Response(
                    301,
                    headers={"location": "/api/v1/scans/"},
                    request=request,
                )
            if url == "http://backend.test/api/v1/scans/":
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
            if url == "http://backend.test/api/v1/scans/1001/raw-results":
                return httpx.Response(
                    301,
                    headers={"location": "/api/v1/scans/1001/raw-results/"},
                    request=request,
                )
            return httpx.Response(200, json={"scanId": 1001, "status": "RAW_UPLOADED"}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            calls.append(("PUT", url, json.loads(content.decode("utf-8"))))
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_last_scan(tmp_path, api_url="http://backend.test/")

    assert response == {"scanId": 1001, "status": "RAW_UPLOADED"}
    assert [call[:2] for call in calls] == [
        ("POST", "http://backend.test/api/v1/scans"),
        ("POST", "http://backend.test/api/v1/scans/"),
        ("PUT", "https://s3.example.com/upload"),
        ("POST", "http://backend.test/api/v1/scans/1001/raw-results"),
        ("POST", "http://backend.test/api/v1/scans/1001/raw-results/"),
    ]


def test_upload_scan_result_to_registered_scan_uses_existing_scan(tmp_path: Path, monkeypatch):
    scan = {
        "scanId": "local-scan-test",
        "projectName": "sample-app",
        "artifacts": [],
        "findings": [{"id": "FND-0001"}],
    }
    calls: list[tuple[str, str, Any, dict | None]] = []

    class FakeClient:
        def __init__(self, timeout: int):
            assert timeout == 30

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def put(self, url: str, content: bytes, headers: dict | None = None):
            calls.append(("PUT", url, json.loads(content.decode("utf-8")), headers))
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
            calls.append(("POST", url, json, headers))
            request = httpx.Request("POST", url)
            return httpx.Response(200, json={"scanId": 1001, "status": "RAW_UPLOADED"}, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_scan_result_to_registered_scan(
        tmp_path,
        scan,
        api_url="http://backend.test/",
        token="agent-token",
        scan_id=1001,
        raw_upload_url="https://s3.example.com/upload",
    )

    assert response == {"scanId": 1001, "status": "RAW_UPLOADED"}
    assert calls == [
        ("PUT", "https://s3.example.com/upload", scan, {"Content-Type": "application/json"}),
        (
            "POST",
            "http://backend.test/api/v1/scans/1001/raw-results",
            {
                "tool": "ssafer-cli",
                "toolVersion": upload.__version__,
                "resultCount": 1,
                "payloadHash": upload._payload_hash(upload._scan_json_bytes(scan)),
            },
            {"Authorization": "Bearer agent-token"},
        ),
    ]


def test_upload_last_server_audit_uses_server_audit_scan_type(tmp_path: Path, monkeypatch):
    audit = {
        "auditId": "audit-test",
        "source": "server-audit",
        "artifacts": [],
        "findings": [{"id": "SRV-0001"}],
    }
    _write_server_audit(tmp_path, audit)
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
                        "data": {
                            "scanId": 3001,
                            "rawResultPath": "s3://ssafer/raw/3001/upload/server_audit.json",
                            "rawUploadUrl": "https://s3.example.com/upload-server-audit",
                        }
                    },
                    request=request,
                )
            return httpx.Response(200, json={"scanId": 3001, "status": "RAW_UPLOADED"}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            calls.append(("PUT", url, json.loads(content.decode("utf-8"))))
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_last_server_audit(tmp_path, api_url="http://backend.test/")

    assert response == {"scanId": 3001, "status": "RAW_UPLOADED"}
    assert calls == [
        (
            "POST",
            "http://backend.test/api/v1/scans",
            {
                "projectName": tmp_path.name,
                "source": "SERVER_AUDIT",
                "scanName": "SSAfer server audit " + tmp_path.name + " audit-test",
                "targetPath": str(tmp_path),
                "includeLogs": False,
                "scanType": "SERVER_AUDIT",
            },
        ),
        ("PUT", "https://s3.example.com/upload-server-audit", audit),
        (
            "POST",
            "http://backend.test/api/v1/scans/3001/raw-results",
            {
                "tool": "ssafer-cli",
                "toolVersion": upload.__version__,
                "resultCount": 1,
                "payloadHash": upload._payload_hash(upload._scan_json_bytes(audit)),
            },
        ),
    ]


def test_upload_error_request_url_keeps_backend_api_url_visible():
    assert (
        main_module._format_upload_request_url("https://api.example.com/api/v1/scans/1/raw-results")
        == "https://api.example.com/api/v1/scans/1/raw-results"
    )


def test_upload_error_request_url_hides_s3_presigned_url():
    assert (
        main_module._format_upload_request_url(
            "https://bucket.s3.ap-northeast-2.amazonaws.com/raw/1/scan_result.json?X-Amz-Signature=secret"
        )
        == "S3 presigned upload URL hidden"
    )


def test_http_transport_error_masks_s3_presigned_url():
    request = httpx.Request(
        "PUT",
        "https://bucket.s3.ap-northeast-2.amazonaws.com/raw/1/scan_result.json?X-Amz-Signature=secret",
    )
    error = httpx.TransportError(
        "failed to PUT https://bucket.s3.ap-northeast-2.amazonaws.com/raw/1/scan_result.json?X-Amz-Signature=secret",
        request=request,
    )

    message = main_module._format_http_transport_error(error)

    assert "S3 presigned upload URL hidden" in message
    assert "X-Amz-Signature" not in message


def test_upload_command_prints_progress_before_upload(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(main_module, "_upload_or_exit", lambda path, api_url=None: {"scanId": 1001})

    result = CliRunner().invoke(app, ["upload", "--path", str(tmp_path)])

    assert result.exit_code == 0
    assert "1001" in result.output
    assert "1001" in result.output


def test_upload_last_scan_rejects_empty_scan_package(tmp_path: Path):
    _write_scan(
        tmp_path,
        {
            "scanId": "empty-scan",
            "analysisStatus": "FAILED",
            "cliSummary": {
                "composeSets": 0,
                "envFiles": 0,
                "dockerfiles": 0,
            },
        },
    )

    with pytest.raises(RuntimeError, match="업로드할 스캔 대상이 없습니다"):
        upload.upload_last_scan(tmp_path)


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
        "https://ssafer.co.kr/api/v1/scans",
        "https://ssafer.co.kr/api/v1/scans/1001/raw-results",
    ]


def test_upload_last_scan_returns_scan_id_from_registration_when_callback_omits_it(tmp_path: Path, monkeypatch):
    scan = {"scanId": "local-scan-test", "artifacts": []}
    _write_scan(tmp_path, scan)

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
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
            return httpx.Response(200, json={"data": {"status": "RAW_UPLOADED"}}, request=request)

        def put(self, url: str, content: bytes, headers: dict | None = None):
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_last_scan(tmp_path)

    assert response["scanId"] == 1001
    assert response["status"] == "RAW_UPLOADED"


def test_upload_last_scan_unwraps_backend_callback_data_response(tmp_path: Path, monkeypatch):
    scan = {"scanId": "local-scan-test", "artifacts": []}
    _write_scan(tmp_path, scan)

    class FakeClient:
        def __init__(self, timeout: int):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url: str, json: dict[str, Any], headers: dict | None = None):
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
            return httpx.Response(
                200,
                json={"message": "CLI raw upload reported", "data": {"scanId": 1001, "status": "QUEUED", "resultCount": 2}},
                request=request,
            )

        def put(self, url: str, content: bytes, headers: dict | None = None):
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload.httpx, "Client", FakeClient)

    response = upload.upload_last_scan(tmp_path)

    assert response == {"scanId": 1001, "status": "QUEUED", "resultCount": 2}


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
        "https://api.ssafer.dev/api/v1/scans/1001/raw-results",
    ]


def test_upload_last_scan_requires_existing_scan(tmp_path: Path):
    with pytest.raises(RuntimeError, match="No local scan package found"):
        upload.upload_last_scan(tmp_path)


def test_upload_last_server_audit_requires_existing_result(tmp_path: Path):
    with pytest.raises(RuntimeError, match="No local server audit package found"):
        upload.upload_last_server_audit(tmp_path)


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
                "scanName": "SSAfer CLI scan local-scan-test",
                "targetPath": str(tmp_path),
                "includeLogs": False,
            },
        ),
        ("PUT", "https://s3.example.com/upload", scan),
        (
            "POST",
            "http://backend.test/api/v1/scans/1001/raw-results",
            {
                "tool": "ssafer-cli",
                "toolVersion": upload.__version__,
                "resultCount": len(scan["findings"]),
                "payloadHash": upload._payload_hash(upload._scan_json_bytes(scan)),
            },
        ),
    ]
