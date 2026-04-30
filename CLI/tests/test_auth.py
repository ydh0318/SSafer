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
from ssafer.core.auth import clear_token, load_endpoint, load_token, save_token
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


def test_load_endpoint_returns_default_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    assert load_endpoint() == "http://localhost:8080"


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
