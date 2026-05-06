from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from typer.testing import CliRunner

import ssafer.core.auth as auth_module
import ssafer.core.upload as upload_module
import ssafer.main as main_module
from ssafer.core.auth import (
    clear_token,
    load_endpoint,
    load_token,
    login_with_credentials,
    register_user,
    save_auth_tokens,
    save_token,
    send_email_verification_code,
    verify_email_code,
)
from ssafer.core.result_store import load_last_scan
from ssafer.core.upload import upload_last_scan
from ssafer.main import app


# ── auth.py 테스트 ─────────────────────────────────────────────────────────────

def test_load_token_from_env_var(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    monkeypatch.setenv("SSAFER_TOKEN", "env-token-123")
    assert load_token() == "env-token-123"


def test_load_token_from_custom_env_var(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    monkeypatch.setenv("PROJECT_SSAFER_TOKEN", "project-token-123")
    assert load_token("PROJECT_SSAFER_TOKEN") == "project-token-123"


def test_custom_token_env_takes_priority(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    monkeypatch.setenv("SSAFER_TOKEN", "default-token")
    monkeypatch.setenv("PROJECT_SSAFER_TOKEN", "project-token")
    assert load_token("PROJECT_SSAFER_TOKEN") == "project-token"


def test_load_token_from_config_file(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_token("saved-token-456")
    assert load_token() == "saved-token-456"


def test_load_token_from_saved_access_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_auth_tokens({"accessToken": "access-token-123", "refreshToken": "refresh-token-123"})
    assert load_token() == "access-token-123"


def test_env_var_takes_priority_over_config(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.setenv("SSAFER_TOKEN", "env-priority-token")
    save_token("config-token")
    assert load_token() == "env-priority-token"


def test_load_token_returns_none_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    assert load_token() is None


def test_save_token_creates_config_dir(monkeypatch, tmp_path):
    nested = tmp_path / "nested" / "dir"
    config_path = nested / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_token("my-token")
    assert config_path.exists()


def test_save_token_writes_yml_file(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_token("my-token")
    import yaml
    data = yaml.safe_load(config_path.read_text())
    assert data["upload"]["token"] == "my-token"


def test_save_auth_tokens_writes_backend_login_response(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens(
        {
            "accessToken": "access-token",
            "accessTokenExpiresAt": "2026-05-04T00:00:00Z",
            "refreshToken": "refresh-token",
            "refreshTokenExpiresAt": "2026-05-11T00:00:00Z",
        },
        endpoint="https://api.example.com",
    )

    import yaml

    data = yaml.safe_load(config_path.read_text())
    assert data["upload"]["accessToken"] == "access-token"
    assert data["upload"]["refreshToken"] == "refresh-token"
    assert data["upload"]["endpoint"] == "https://api.example.com"
    assert "token" not in data["upload"]


def test_login_with_credentials_posts_to_backend_auth_login(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            request = httpx.Request("POST", url)
            return httpx.Response(
                200,
                json={
                    "data": {
                        "accessToken": "access-token",
                        "refreshToken": "refresh-token",
                    }
                },
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", lambda **_: FakeClient())

    data = login_with_credentials("https://api.example.com/", "user@example.com", "pw")

    assert captured == {
        "url": "https://api.example.com/api/v1/auth/login",
        "json": {"email": "user@example.com", "password": "pw"},
    }
    assert data["accessToken"] == "access-token"


def test_register_user_posts_to_backend_users(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            request = httpx.Request("POST", url)
            return httpx.Response(
                201,
                json={"data": {"userId": 1001}},
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", lambda **_: FakeClient())

    data = register_user("https://api.example.com/", "user@example.com", "User", "password123")

    assert captured == {
        "url": "https://api.example.com/api/v1/users",
        "json": {"email": "user@example.com", "displayName": "User", "password": "password123"},
    }
    assert data["userId"] == 1001


def test_send_email_verification_code_posts_to_backend_email_send_code(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            request = httpx.Request("POST", url)
            return httpx.Response(200, json={"data": {}}, request=request)

    monkeypatch.setattr(auth_module.httpx, "Client", lambda **_: FakeClient())

    send_email_verification_code("https://api.example.com/", "user@example.com")

    assert captured == {
        "url": "https://api.example.com/api/v1/auth/email/send-code",
        "json": {"email": "user@example.com"},
    }


def test_verify_email_code_posts_to_backend_email_verify_code(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            request = httpx.Request("POST", url)
            return httpx.Response(200, json={"data": {}}, request=request)

    monkeypatch.setattr(auth_module.httpx, "Client", lambda **_: FakeClient())

    verify_email_code("https://api.example.com/", "user@example.com", "123456")

    assert captured == {
        "url": "https://api.example.com/api/v1/auth/email/verify-code",
        "json": {"email": "user@example.com", "code": "123456"},
    }


def test_save_token_with_endpoint(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_token("my-token", endpoint="https://api.example.com")
    assert load_endpoint() == "https://api.example.com"


def test_clear_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_token("to-delete")
    clear_token()
    assert load_token() is None


def test_logout_command_clears_saved_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_token("to-delete")

    result = CliRunner().invoke(app, ["logout"])

    assert result.exit_code == 0
    assert load_token() is None


def test_login_command_authenticates_with_backend_and_saves_tokens(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_login(endpoint: str, email: str, password: str) -> dict[str, str]:
        assert endpoint == "https://api.example.com"
        assert email == "user@example.com"
        assert password == "secret-password"
        return {"accessToken": "access-token", "refreshToken": "refresh-token"}

    monkeypatch.setattr(auth_module, "login_with_credentials", fake_login)

    result = CliRunner().invoke(
        app,
        ["login", "--endpoint", "https://api.example.com"],
        input="user@example.com\nsecret-password\n",
    )

    assert result.exit_code == 0
    assert load_token() == "access-token"
    assert load_endpoint() == "https://api.example.com"


def test_signup_command_registers_backend_user(monkeypatch):
    calls: list[tuple[str, str, str | None, str | None]] = []

    def fake_send(endpoint: str, email: str) -> dict[str, str]:
        calls.append(("send", endpoint, email, None))
        return {}

    def fake_verify(endpoint: str, email: str, code: str) -> dict[str, str]:
        calls.append(("verify", endpoint, email, code))
        return {}

    def fake_register(endpoint: str, email: str, display_name: str, password: str) -> dict[str, int]:
        calls.append(("register", endpoint, email, f"{display_name}:{password}"))
        return {"userId": 1001}

    monkeypatch.setattr(auth_module, "send_email_verification_code", fake_send)
    monkeypatch.setattr(auth_module, "verify_email_code", fake_verify)
    monkeypatch.setattr(auth_module, "register_user", fake_register)

    result = CliRunner().invoke(
        app,
        ["signup", "--endpoint", "https://api.example.com"],
        input="user@example.com\nUser\npassword123\n123456\n",
    )

    assert result.exit_code == 0
    assert calls == [
        ("send", "https://api.example.com", "user@example.com", None),
        ("verify", "https://api.example.com", "user@example.com", "123456"),
        ("register", "https://api.example.com", "user@example.com", "User:password123"),
    ]


def test_send_email_code_command_requests_backend_email_code(monkeypatch):
    captured: dict[str, str] = {}

    def fake_send(endpoint: str, email: str) -> dict[str, str]:
        captured["endpoint"] = endpoint
        captured["email"] = email
        return {}

    monkeypatch.setattr(auth_module, "send_email_verification_code", fake_send)

    result = CliRunner().invoke(
        app,
        ["send-email-code", "--endpoint", "https://api.example.com"],
        input="user@example.com\n",
    )

    assert result.exit_code == 0
    assert captured == {
        "endpoint": "https://api.example.com",
        "email": "user@example.com",
    }


def test_verify_email_command_verifies_backend_email_code(monkeypatch):
    captured: dict[str, str] = {}

    def fake_verify(endpoint: str, email: str, code: str) -> dict[str, str]:
        captured["endpoint"] = endpoint
        captured["email"] = email
        captured["code"] = code
        return {}

    monkeypatch.setattr(auth_module, "verify_email_code", fake_verify)

    result = CliRunner().invoke(
        app,
        ["verify-email", "--endpoint", "https://api.example.com"],
        input="user@example.com\n123456\n",
    )

    assert result.exit_code == 0
    assert captured == {
        "endpoint": "https://api.example.com",
        "email": "user@example.com",
        "code": "123456",
    }


def test_auth_commands_print_backend_error_code(monkeypatch):
    def fake_send(endpoint: str, email: str) -> dict[str, str]:
        request = httpx.Request("POST", f"{endpoint}/api/v1/auth/email/send-code")
        response = httpx.Response(
            409,
            json={"code": "DUPLICATE_EMAIL", "message": "Email is already registered"},
            request=request,
        )
        raise httpx.HTTPStatusError("conflict", request=request, response=response)

    monkeypatch.setattr(auth_module, "send_email_verification_code", fake_send)

    result = CliRunner().invoke(
        app,
        ["send-email-code", "--endpoint", "https://api.example.com"],
        input="user@example.com\n",
    )

    assert result.exit_code == 1
    assert "DUPLICATE_EMAIL" in result.output
    assert "Email is" in result.output
    assert "already registered" in result.output


def test_load_endpoint_returns_default_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    assert load_endpoint() == "https://k14b105.p.ssafy.io"


def test_load_endpoint_returns_saved_endpoint(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_token("t", endpoint="https://custom.server.com")
    assert load_endpoint() == "https://custom.server.com"


# ── upload.py Bearer 헤더 테스트 ──────────────────────────────────────────────

def _write_scan(project_root: Path, scan: dict[str, Any]) -> None:
    results_dir = project_root / ".ssafer" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    scan_file = results_dir / "test-scan.json"
    scan_file.write_text(json.dumps(scan), encoding="utf-8")
    (results_dir / "last_scan.txt").write_text(scan_file.name, encoding="utf-8")


def test_upload_includes_bearer_token_header(tmp_path, monkeypatch):
    _write_scan(tmp_path, {"scanId": "test-123"})
    captured: list[dict] = []

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict, headers: dict | None = None):
            captured.append({"url": url, "headers": headers or {}})
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
            captured.append({"url": url, "headers": headers or {}})
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload_module.httpx, "Client", lambda **_: FakeClient())
    upload_last_scan(tmp_path, token="my-bearer-token")
    assert len(captured) == 3
    assert captured[0]["headers"].get("Authorization") == "Bearer my-bearer-token"
    assert captured[1]["headers"] == {"Content-Type": "application/json"}
    assert captured[2]["headers"].get("Authorization") == "Bearer my-bearer-token"


def test_upload_no_auth_header_when_no_token(tmp_path, monkeypatch):
    _write_scan(tmp_path, {"scanId": "test-456"})
    captured: list[dict] = []

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict, headers: dict | None = None):
            captured.append({"url": url, "headers": headers or {}})
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
            captured.append({"url": url, "headers": headers or {}})
            request = httpx.Request("PUT", url)
            return httpx.Response(200, request=request)

    monkeypatch.setattr(upload_module.httpx, "Client", lambda **_: FakeClient())
    upload_last_scan(tmp_path, token=None)
    assert len(captured) == 3
    assert "Authorization" not in captured[0]["headers"]
    assert "Authorization" not in captured[2]["headers"]


def test_cli_upload_uses_project_config_endpoint_and_token_env(tmp_path, monkeypatch):
    _write_scan(tmp_path, {"scanId": "test-789"})
    (tmp_path / "ssafer.yml").write_text(
        """
upload:
  endpoint: https://project-api.example.com
  token_env: PROJECT_SSAFER_TOKEN
""",
        encoding="utf-8",
    )
    monkeypatch.setenv("PROJECT_SSAFER_TOKEN", "project-token")
    captured: dict[str, Any] = {}

    def fake_upload_last_scan(path: Path, api_url: str | None = None, token: str | None = None):
        captured["path"] = path
        captured["api_url"] = api_url
        captured["token"] = token
        return {"scanId": "ok"}

    monkeypatch.setattr(main_module, "upload_last_scan", fake_upload_last_scan)

    response = main_module._upload_or_exit(tmp_path, api_url=None)

    assert response == {"scanId": "ok"}
    assert captured == {
        "path": tmp_path,
        "api_url": "https://project-api.example.com",
        "token": "project-token",
    }
