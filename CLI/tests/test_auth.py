from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import click
import pytest
from typer.testing import CliRunner

import ssafer.core.auth as auth_module
import ssafer.core.upload as upload_module
import ssafer.main as main_module
from ssafer.core.auth import (
    clear_agent_config,
    clear_token,
    create_project,
    describe_token_source,
    enter_guest_mode,
    find_agent_config_path,
    get_project_agent_status,
    issue_project_agent_token,
    list_projects,
    load_agent_config,
    load_endpoint,
    load_token,
    login_with_credentials,
    normalize_api_url,
    register_user,
    save_agent_config,
    save_auth_tokens,
    save_token,
    send_email_verification_code,
    verify_email_code,
    withdraw_current_user,
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


def test_describe_token_source_reports_env_override(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.setenv("SSAFER_TOKEN", "env-priority-token")
    save_auth_tokens({"accessToken": "access-token"})

    assert describe_token_source() == "env:SSAFER_TOKEN"


def test_describe_token_source_reports_config_access_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_auth_tokens({"accessToken": "access-token"})

    assert describe_token_source() == "config:upload.accessToken"


def test_load_token_returns_none_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_module, "CONFIG_PATH", tmp_path / "config.yml")
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    assert load_token() is None


def test_help_shows_user_facing_commands_only():
    result = CliRunner().invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "프로젝트와 서버 보안 점검" in result.output
    assert "계정/상태" in result.output
    assert "로컬 점검" in result.output
    assert "수정 적용" in result.output
    assert "로컬 Agent" in result.output
    assert "status" in result.output
    assert "login" in result.output
    assert "guest" in result.output
    assert "guest-login" not in result.output
    assert "signup" in result.output
    assert "run" in result.output
    assert "upload" in result.output
    assert "apply" in result.output
    assert "server" in result.output
    assert "tools" in result.output
    assert "project-create" not in result.output
    assert "install-tools" not in result.output
    assert "server-audit" not in result.output
    assert "│ scan" not in result.output
    assert "│ fix" not in result.output
    assert "│ last" not in result.output
    assert "agent" in result.output
    assert result.output.index("signup") < result.output.index("login")
    assert result.output.index("login") < result.output.index("logout")
    assert result.output.index("logout") < result.output.index("guest")
    assert result.output.index("guest") < result.output.index("withdraw")
    assert "agent-watch" not in result.output
    assert "agent-init" not in result.output
    assert "send-email-code" not in result.output
    assert "verify-email" not in result.output
    assert "install-completion" not in result.output
    assert "show-completion" not in result.output


def test_status_command_prints_saved_login_and_agent_config(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_auth_tokens({"accessToken": "access-token-123"}, endpoint="https://api.example.com")
    save_agent_config(
        {"agentId": 7, "projectId": 10, "agentToken": "agent-token-123"},
        endpoint="https://api.example.com",
        project_root=tmp_path,
    )

    result = CliRunner().invoke(app, ["status"])

    assert result.exit_code == 0
    assert "로그인" in result.output
    assert "됨" in result.output
    assert "https://api.example.com" in result.output
    assert "upload.accessToken" in result.output
    assert "agentId=7, projectId=10" in result.output
    assert "agent-token-123" not in result.output
    assert "access-token-123" not in result.output


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


def test_save_auth_tokens_writes_guest_login_response(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens(
        {
            "guestAccessToken": "guest-access-token",
            "expiresAt": "2026-05-12T00:00:00Z",
        },
        endpoint="https://api.example.com",
    )

    import yaml

    data = yaml.safe_load(config_path.read_text())
    assert data["upload"]["accessToken"] == "guest-access-token"
    assert data["upload"]["authMode"] == "guest"
    assert data["upload"]["guestAccessTokenExpiresAt"] == "2026-05-12T00:00:00Z"
    assert data["upload"]["endpoint"] == "https://api.example.com"
    assert "token" not in data["upload"]


def test_issue_project_agent_token_posts_to_backend(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, timeout: int):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def post(self, url: str, headers: dict[str, str]):
            captured["url"] = url
            captured["headers"] = headers
            request = httpx.Request("POST", url)
            return httpx.Response(
                200,
                json={"data": {"agentId": 3, "projectId": 10, "agentToken": "raw-agent-token"}},
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", FakeClient)

    data = issue_project_agent_token("https://api.example.com/", 10, "access-token")

    assert captured == {
        "timeout": 30,
        "url": "https://api.example.com/api/v1/projects/10/agent/token",
        "headers": {"Authorization": "Bearer access-token"},
    }
    assert data["agentToken"] == "raw-agent-token"


def test_list_projects_fetches_backend_projects(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def get(self, url: str, params: dict[str, int], headers: dict[str, str]):
            captured["url"] = url
            captured["params"] = params
            captured["headers"] = headers
            request = httpx.Request("GET", url)
            return httpx.Response(
                200,
                json={
                    "data": {
                        "items": [
                            {"projectId": 10, "name": "first-project"},
                            {"projectId": 20, "name": "second-project"},
                        ]
                    }
                },
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", FakeClient)

    projects = list_projects("https://api.example.com/", "access-token")

    assert captured == {
        "client_kwargs": {"timeout": 30, "follow_redirects": True},
        "url": "https://api.example.com/api/v1/projects",
        "params": {"page": 0, "size": 100},
        "headers": {"Authorization": "Bearer access-token"},
    }
    assert projects == [
        {"projectId": 10, "name": "first-project"},
        {"projectId": 20, "name": "second-project"},
    ]


def test_get_project_agent_status_fetches_backend_status(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def get(self, url: str, headers: dict[str, str]):
            captured["url"] = url
            captured["headers"] = headers
            request = httpx.Request("GET", url)
            return httpx.Response(
                200,
                json={
                    "data": {
                        "agentId": 3,
                        "status": "ONLINE",
                        "connectedAt": "2026-05-12T00:00:00Z",
                        "lastSeenAt": "2026-05-12T00:00:10Z",
                        "currentTaskType": None,
                    }
                },
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", FakeClient)

    status = get_project_agent_status("https://api.example.com/", 10, "access-token")

    assert captured == {
        "client_kwargs": {"timeout": 30, "follow_redirects": True},
        "url": "https://api.example.com/api/v1/projects/10/agent/status",
        "headers": {"Authorization": "Bearer access-token"},
    }
    assert status["status"] == "ONLINE"
    assert status["agentId"] == 3


def test_withdraw_current_user_deletes_backend_user(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def delete(self, url: str, headers: dict[str, str]):
            captured["url"] = url
            captured["headers"] = headers
            request = httpx.Request("DELETE", url)
            return httpx.Response(200, json={"data": None}, request=request)

    monkeypatch.setattr(auth_module.httpx, "Client", FakeClient)

    withdraw_current_user("https://api.example.com/", "access-token")

    assert captured == {
        "client_kwargs": {"timeout": 30, "follow_redirects": True},
        "url": "https://api.example.com/api/v1/users",
        "headers": {"Authorization": "Bearer access-token"},
    }


def test_create_project_posts_backend_project(monkeypatch):
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, timeout: int):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def post(self, url: str, json: dict[str, Any] | None = None, headers: dict[str, str] | None = None):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            request = httpx.Request("POST", url)
            return httpx.Response(
                201,
                json={"data": {"projectId": 42}},
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", FakeClient)

    data = create_project("https://api.example.com/", "access-token", name="S14P31B105")

    assert captured == {
        "timeout": 30,
        "url": "https://api.example.com/api/v1/projects",
        "json": {
            "name": "S14P31B105",
            "description": None,
            "defaultScanMode": "AGENT",
            "monitorEnabled": False,
        },
        "headers": {"Authorization": "Bearer access-token"},
    }
    assert data == {"projectId": 42}


def test_save_and_load_agent_config(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    save_agent_config(
        {"agentId": 3, "projectId": 10, "agentToken": "raw-agent-token"},
        endpoint="https://api.example.com",
        project_root=tmp_path,
    )

    assert load_agent_config(tmp_path) == {
        "agentId": 3,
        "projectId": 10,
        "agentToken": "raw-agent-token",
        "endpoint": "https://api.example.com",
    }
    nested = tmp_path / "other"
    nested.mkdir()
    assert load_agent_config(nested)["agentId"] == 3
    assert find_agent_config_path(nested) == tmp_path / ".ssafer" / "agent.yml"


def test_save_agent_config_falls_back_to_home_when_project_config_is_unwritable(monkeypatch, tmp_path):
    config_path = tmp_path / "home" / "config.yml"
    project_root = tmp_path / "project"
    blocked_parent = tmp_path / "blocked"
    blocked_path = blocked_parent / "agent.yml"
    original_mkdir = Path.mkdir

    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.setattr(auth_module, "project_agent_config_path", lambda _project_root=None: blocked_path)

    def fake_mkdir(self: Path, *args: Any, **kwargs: Any) -> None:
        if self == blocked_parent:
            raise PermissionError("blocked")
        original_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", fake_mkdir)

    save_agent_config(
        {"agentId": 3, "projectId": 10, "agentToken": "raw-agent-token"},
        endpoint="https://api.example.com",
        project_root=project_root,
    )

    assert load_agent_config(project_root) == {
        "agentId": 3,
        "projectId": 10,
        "agentToken": "raw-agent-token",
        "endpoint": "https://api.example.com",
    }
    assert not blocked_path.exists()


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

    def fake_client(**kwargs):
        captured["client_kwargs"] = kwargs
        return FakeClient()

    monkeypatch.setattr(auth_module.httpx, "Client", fake_client)

    data = login_with_credentials("https://api.example.com/", "user@example.com", "pw")

    assert captured == {
        "client_kwargs": {"timeout": 30},
        "url": "https://api.example.com/api/v1/auth/login",
        "json": {"email": "user@example.com", "password": "pw"},
    }
    assert data["accessToken"] == "access-token"


def test_enter_guest_mode_posts_to_backend_guest_enter(monkeypatch):
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
                        "guestAccessToken": "guest-token",
                        "expiresAt": "2026-05-12T00:00:00Z",
                    }
                },
                request=request,
            )

    def fake_client(**kwargs):
        captured["client_kwargs"] = kwargs
        return FakeClient()

    monkeypatch.setattr(auth_module.httpx, "Client", fake_client)

    data = enter_guest_mode("https://api.example.com/")

    assert captured == {
        "client_kwargs": {"timeout": 30},
        "url": "https://api.example.com/api/v1/guests/enter",
        "json": {},
    }
    assert data["guestAccessToken"] == "guest-token"


def test_login_with_credentials_redirect_keeps_post_method(monkeypatch):
    calls: list[dict[str, Any]] = []

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, url: str, json: dict, headers: dict | None = None):
            calls.append({"url": url, "json": json, "headers": headers})
            request = httpx.Request("POST", url)
            if len(calls) == 1:
                return httpx.Response(
                    301,
                    headers={"location": "/api/v1/auth/login/"},
                    request=request,
                )
            return httpx.Response(
                200,
                json={"data": {"accessToken": "access-token"}},
                request=request,
            )

    monkeypatch.setattr(auth_module.httpx, "Client", lambda **_: FakeClient())

    data = login_with_credentials("https://api.example.com/", "user@example.com", "pw")

    assert data["accessToken"] == "access-token"
    assert calls == [
        {
            "url": "https://api.example.com/api/v1/auth/login",
            "json": {"email": "user@example.com", "password": "pw"},
            "headers": None,
        },
        {
            "url": "https://api.example.com/api/v1/auth/login/",
            "json": {"email": "user@example.com", "password": "pw"},
            "headers": None,
        },
    ]


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


def test_clear_agent_config(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens({"accessToken": "access-token"}, "https://api.example.com")
    save_agent_config(
        {"agentId": 1, "projectId": 2, "agentToken": "agent-token"},
        "https://api.example.com",
        tmp_path,
    )

    clear_agent_config(tmp_path)

    assert load_token() == "access-token"
    assert load_agent_config(tmp_path) == {}


def test_logout_command_clears_saved_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_token("to-delete")
    save_agent_config(
        {"agentId": 1, "projectId": 2, "agentToken": "agent-token"},
        "https://api.example.com",
        tmp_path,
    )

    result = CliRunner().invoke(app, ["logout"])

    assert result.exit_code == 0
    assert load_token() is None
    assert load_agent_config(tmp_path) == {}


def test_withdraw_command_calls_backend_and_clears_local_state(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)
    save_auth_tokens({"accessToken": "access-token"}, "https://api.example.com")
    save_agent_config(
        {"agentId": 1, "projectId": 2, "agentToken": "agent-token"},
        "https://api.example.com",
        tmp_path,
    )
    captured: dict[str, str] = {}

    def fake_withdraw(endpoint: str, access_token: str) -> None:
        captured["endpoint"] = endpoint
        captured["access_token"] = access_token

    monkeypatch.setattr(auth_module, "withdraw_current_user", fake_withdraw)

    result = CliRunner().invoke(app, ["withdraw", "--yes"])

    assert result.exit_code == 0
    assert captured == {"endpoint": "https://api.example.com", "access_token": "access-token"}
    assert load_token() is None
    assert load_agent_config(tmp_path) == {}


def test_withdraw_command_requires_login(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SSAFER_TOKEN", raising=False)

    result = CliRunner().invoke(app, ["withdraw", "--yes"])

    assert result.exit_code == 1
    assert "회원탈퇴를 진행하려면" in result.output


def test_login_command_authenticates_with_backend_and_saves_tokens(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    other_project = tmp_path / "other"
    save_agent_config(
        {"agentId": 1, "projectId": 2, "agentToken": "stale-agent-token"},
        "https://api.example.com",
        other_project,
    )

    def fake_login(endpoint: str, email: str, password: str) -> dict[str, str]:
        assert endpoint == "https://api.example.com"
        assert email == "user@example.com"
        assert password == "secret-password"
        return {"accessToken": "access-token", "refreshToken": "refresh-token"}

    monkeypatch.setattr(auth_module, "login_with_credentials", fake_login)

    result = CliRunner().invoke(
        app,
        ["login", "--endpoint", "https://api.example.com"],
        input="user@example.com\nsecret-password\nn\n",
    )

    assert result.exit_code == 0
    assert load_token() == "access-token"
    assert load_endpoint() == "https://api.example.com"
    assert load_agent_config(other_project)["agentId"] == 1
    assert "지금 Local Agent를 시작할까요?" in result.output
    assert "웹에서 이 PC/서버에 스캔이나 수정 적용을 요청하려면" in result.output
    assert "Agent는 시작하지 않았습니다" in result.output


def test_login_command_can_start_agent_after_login(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    started: dict[str, object] = {}

    def fake_login(endpoint: str, email: str, password: str) -> dict[str, str]:
        return {"accessToken": "access-token", "refreshToken": "refresh-token"}

    def fake_start_agent(*, path: Path, refresh_token: bool = False) -> None:
        started["path"] = path
        started["refresh_token"] = refresh_token

    monkeypatch.setattr(auth_module, "login_with_credentials", fake_login)
    monkeypatch.setattr(main_module, "_start_agent", fake_start_agent)

    result = CliRunner().invoke(
        app,
        ["login", "--endpoint", "https://api.example.com"],
        input="user@example.com\nsecret-password\ny\n",
    )

    assert result.exit_code == 0
    assert started == {"path": Path("."), "refresh_token": True}


def test_login_command_clears_project_agent_config(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    save_auth_tokens({"accessToken": "x.eyJzdWIiOiJ1c2VyOjEifQ.x"}, "https://api.example.com")
    save_agent_config(
        {"agentId": 1, "projectId": 10, "agentToken": "old-agent-token"},
        "https://api.example.com",
        tmp_path,
    )

    def fake_login(endpoint: str, email: str, password: str) -> dict[str, str]:
        return {"accessToken": "x.eyJzdWIiOiJ1c2VyOjIifQ.x", "refreshToken": "new-refresh-token"}

    monkeypatch.setattr(auth_module, "login_with_credentials", fake_login)

    result = CliRunner().invoke(
        app,
        ["login", "--endpoint", "https://api.example.com"],
        input="user@example.com\nsecret-password\nn\n",
    )

    assert result.exit_code == 0
    assert load_token() == "x.eyJzdWIiOiJ1c2VyOjIifQ.x"
    assert load_agent_config(tmp_path) == {}


def test_login_command_preserves_project_agent_config_for_same_account(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    save_auth_tokens({"accessToken": "x.eyJzdWIiOiJ1c2VyOjEifQ.x"}, "https://api.example.com")
    save_agent_config(
        {"agentId": 1, "projectId": 10, "agentToken": "old-agent-token"},
        "https://api.example.com",
        tmp_path,
    )

    def fake_login(endpoint: str, email: str, password: str) -> dict[str, str]:
        return {"accessToken": "x.eyJzdWIiOiJ1c2VyOjEifQ.x", "refreshToken": "new-refresh-token"}

    monkeypatch.setattr(auth_module, "login_with_credentials", fake_login)

    result = CliRunner().invoke(
        app,
        ["login", "--endpoint", "https://api.example.com"],
        input="user@example.com\nsecret-password\nn\n",
    )

    assert result.exit_code == 0
    assert load_token() == "x.eyJzdWIiOiJ1c2VyOjEifQ.x"
    assert load_agent_config(tmp_path)["agentId"] == 1


def test_login_command_guest_saves_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        assert endpoint == "https://api.example.com"
        assert device_id is None
        return {"guestAccessToken": "guest-token", "expiresAt": "2026-05-12T00:00:00Z"}

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)

    result = CliRunner().invoke(app, ["login", "--guest", "--endpoint", "https://api.example.com"], input="n\n")

    assert result.exit_code == 0
    assert load_token() == "guest-token"
    assert load_endpoint() == "https://api.example.com"
    assert "게스트 로그인 완료" in result.output


def test_guest_login_command_saves_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        assert endpoint == "https://api.example.com"
        assert device_id is None
        return {"guestAccessToken": "guest-token", "expiresAt": "2026-05-12T00:00:00Z"}

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)

    result = CliRunner().invoke(app, ["guest-login", "--endpoint", "https://api.example.com"], input="n\n")

    assert result.exit_code == 0
    assert load_token() == "guest-token"
    assert load_endpoint() == "https://api.example.com"
    assert "show-url" in result.output


def test_guest_command_saves_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        assert endpoint == "https://api.example.com"
        assert device_id is None
        return {"guestAccessToken": "guest-token", "expiresAt": "2026-05-12T00:00:00Z"}

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)

    result = CliRunner().invoke(app, ["guest", "--endpoint", "https://api.example.com"], input="n\n")

    assert result.exit_code == 0
    assert load_token() == "guest-token"
    assert load_endpoint() == "https://api.example.com"
    assert "show-url" in result.output


def test_guest_command_show_url_reuses_saved_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens({"guestAccessToken": "saved guest/token"}, "https://api.example.com")

    def fail_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        raise AssertionError("guest command should reuse saved guest token")

    monkeypatch.setattr(auth_module, "enter_guest_mode", fail_guest)
    monkeypatch.setattr(
        main_module,
        "_prompt_start_agent_after_login",
        lambda: (_ for _ in ()).throw(AssertionError("guest --show-url should not prompt agent start")),
    )

    result = CliRunner().invoke(app, ["guest", "--show-url"])

    assert result.exit_code == 0
    assert load_token() == "saved guest/token"
    assert "https://api.example.com/guest/continue?token=saved+guest%2Ftoken" in result.output
    assert "Local Agent" not in result.output


def test_login_command_guest_token_saves_web_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    result = CliRunner().invoke(
        app,
        ["login", "--guest-token", "web-guest-token", "--endpoint", "https://api.example.com"],
        input="n\n",
    )

    assert result.exit_code == 0
    assert load_token() == "web-guest-token"
    assert load_endpoint() == "https://api.example.com"
    assert "CLI" in result.output


def test_login_command_guest_prints_web_continue_url(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        return {"guestAccessToken": "guest token/with space", "expiresAt": "2026-05-12T00:00:00Z"}

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)

    result = CliRunner().invoke(
        app,
        ["login", "--guest", "--show-url", "--endpoint", "https://api.example.com"],
        input="n\n",
    )

    assert result.exit_code == 0
    assert "https://api.example.com/guest/continue?token=guest+token%2Fwith+space" in result.output


def test_login_command_guest_masks_web_continue_url_by_default(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        return {"guestAccessToken": "secret-token", "expiresAt": "2026-05-12T00:00:00Z"}

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)

    result = CliRunner().invoke(app, ["login", "--guest", "--endpoint", "https://api.example.com"], input="n\n")

    assert result.exit_code == 0
    assert "show-url" in result.output
    assert "https://api.example.com/guest/continue?token=" not in result.output
    assert "secret-token" not in result.output


def test_login_command_guest_prompts_agent_start(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    started: dict[str, object] = {}

    def fake_guest(endpoint: str, device_id: str | None = None) -> dict[str, str]:
        return {"guestAccessToken": "guest-token", "expiresAt": "2026-05-12T00:00:00Z"}

    def fake_start_agent(*, path: Path, refresh_token: bool) -> None:
        started["path"] = path
        started["refresh_token"] = refresh_token

    monkeypatch.setattr(auth_module, "enter_guest_mode", fake_guest)
    monkeypatch.setattr(main_module, "_start_agent", fake_start_agent)

    result = CliRunner().invoke(
        app,
        ["login", "--guest", "--endpoint", "https://api.example.com"],
        input="y\n",
    )

    assert result.exit_code == 0
    assert started == {"path": Path("."), "refresh_token": True}


def test_login_command_guest_token_prompts_agent_start(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    started: dict[str, object] = {}

    def fake_start_agent(*, path: Path, refresh_token: bool) -> None:
        started["path"] = path
        started["refresh_token"] = refresh_token

    monkeypatch.setattr(main_module, "_start_agent", fake_start_agent)

    result = CliRunner().invoke(
        app,
        ["login", "--guest-token", "web-guest-token", "--endpoint", "https://api.example.com"],
        input="y\n",
    )

    assert result.exit_code == 0
    assert load_token() == "web-guest-token"
    assert started == {"path": Path("."), "refresh_token": True}


def test_login_command_rejects_guest_and_guest_token(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)

    result = CliRunner().invoke(app, ["login", "--guest", "--guest-token", "token"])

    assert result.exit_code == 1
    assert "guest-token" in result.output


def test_start_agent_refresh_selects_project_instead_of_reusing_saved_project(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    monkeypatch.chdir(tmp_path)
    save_auth_tokens({"accessToken": "access-token"}, "https://api.example.com")
    save_agent_config(
        {"agentId": 1, "projectId": 1, "agentToken": "old-agent-token"},
        "https://api.example.com",
        tmp_path,
    )
    issued: dict[str, object] = {}

    def fake_select_project(endpoint: str, access_token: str) -> int:
        assert endpoint == "https://api.example.com"
        assert access_token == "access-token"
        return 8

    def fake_issue(
        project_id: int,
        endpoint: str,
        label: str,
        *,
        access_token: str | None = None,
        project_root: Path | None = None,
    ) -> dict[str, object]:
        issued["project_id"] = project_id
        issued["endpoint"] = endpoint
        issued["label"] = label
        issued["access_token"] = access_token
        issued["project_root"] = project_root
        return {"agentId": 8, "projectId": project_id, "agentToken": "new-agent-token"}

    def fake_run_agent_watch(**kwargs: object) -> None:
        issued["agent_config"] = kwargs["agent_config"]

    monkeypatch.setattr(main_module, "_select_agent_project_id", fake_select_project)
    monkeypatch.setattr(main_module, "_issue_and_save_agent_token", fake_issue)
    monkeypatch.setattr(main_module, "_run_agent_watch", fake_run_agent_watch)

    main_module._start_agent(path=Path("."), refresh_token=True)

    assert issued["project_id"] == 8
    assert issued["project_root"] == tmp_path.resolve()
    assert issued["agent_config"] == {"agentId": 8, "projectId": 8, "agentToken": "new-agent-token"}


def test_agent_command_accepts_verbose(monkeypatch, tmp_path):
    started: dict[str, object] = {}

    def fake_start_agent(*, path: Path, refresh_token: bool = False, verbose: bool = False) -> None:
        started["path"] = path
        started["refresh_token"] = refresh_token
        started["verbose"] = verbose

    monkeypatch.setattr(main_module, "_start_agent", fake_start_agent)

    result = CliRunner().invoke(app, ["agent", "--path", str(tmp_path), "--verbose"])

    assert result.exit_code == 0
    assert started == {"path": tmp_path, "refresh_token": False, "verbose": True}


def test_select_agent_project_id_stops_when_no_projects_and_user_declines_create(monkeypatch):
    monkeypatch.setattr(auth_module, "list_projects", lambda endpoint, token: [])
    monkeypatch.setattr(main_module.typer, "confirm", lambda *args, **kwargs: False)

    with pytest.raises(click.exceptions.Exit):
        main_module._select_agent_project_id("https://api.example.com", "access-token")


def test_select_agent_project_id_creates_project_when_no_projects(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(auth_module, "list_projects", lambda endpoint, token: [])
    monkeypatch.setattr(main_module.typer, "confirm", lambda *args, **kwargs: True)
    monkeypatch.setattr(main_module.typer, "prompt", lambda *args, **kwargs: "created-project")

    def fake_create_project(endpoint: str, access_token: str, *, name: str, **kwargs: object) -> dict[str, int]:
        assert endpoint == "https://api.example.com"
        assert access_token == "access-token"
        assert name == "created-project"
        return {"projectId": 77}

    monkeypatch.setattr(auth_module, "create_project", fake_create_project)

    project_id = main_module._select_agent_project_id("https://api.example.com", "access-token")

    assert project_id == 77


def test_project_create_command_creates_project(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens({"accessToken": "access-token"}, "https://api.example.com")
    captured: dict[str, object] = {}

    def fake_create_project(
        endpoint: str,
        access_token: str,
        *,
        name: str,
        description: str | None = None,
        **kwargs: object,
    ) -> dict[str, int]:
        captured["endpoint"] = endpoint
        captured["access_token"] = access_token
        captured["name"] = name
        captured["description"] = description
        return {"projectId": 88}

    monkeypatch.setattr(auth_module, "create_project", fake_create_project)

    result = CliRunner().invoke(
        app,
        ["project-create", "--name", "cli-project", "--description", "from cli"],
    )

    assert result.exit_code == 0
    assert captured == {
        "endpoint": "https://api.example.com",
        "access_token": "access-token",
        "name": "cli-project",
        "description": "from cli",
    }
    assert "projectId=88" in result.output


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
    assert "SSAfer 계정을 생성합니다" in result.output
    assert "이메일 인증 코드를 발송합니다" in result.output
    assert "인증 코드를 확인합니다" in result.output
    assert "회원가입을 요청합니다" in result.output
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


def test_agent_init_command_issues_and_saves_agent_token(monkeypatch):
    captured: dict[str, Any] = {}

    monkeypatch.setattr(auth_module, "load_endpoint", lambda: "https://api.example.com")
    monkeypatch.setattr(auth_module, "load_token", lambda: "access-token")

    def fake_issue(endpoint: str, project_id: int, access_token: str) -> dict[str, Any]:
        captured["issue"] = {
            "endpoint": endpoint,
            "project_id": project_id,
            "access_token": access_token,
        }
        return {"agentId": 3, "projectId": 10, "agentToken": "raw-agent-token"}

    def fake_save(
        agent_data: dict[str, Any],
        endpoint: str | None = None,
        project_root: Path | None = None,
    ) -> None:
        captured["save"] = {
            "agent_data": agent_data,
            "endpoint": endpoint,
            "project_root": project_root,
        }

    monkeypatch.setattr(auth_module, "issue_project_agent_token", fake_issue)
    monkeypatch.setattr(auth_module, "save_agent_config", fake_save)

    result = CliRunner().invoke(app, ["agent-init", "--project-id", "10"])

    assert result.exit_code == 0
    assert captured["issue"] == {
        "endpoint": "https://api.example.com",
        "project_id": 10,
        "access_token": "access-token",
    }
    assert captured["save"] == {
        "agent_data": {"agentId": 3, "projectId": 10, "agentToken": "raw-agent-token"},
        "endpoint": "https://api.example.com",
        "project_root": None,
    }
    assert "agentId: 3" in result.output
    assert "agentId: 3" in result.output


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
    assert load_endpoint() == "https://ssafer.co.kr"


def test_load_endpoint_returns_saved_endpoint(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_token("t", endpoint="https://custom.server.com")
    assert load_endpoint() == "https://custom.server.com"


# ── upload.py Bearer 헤더 테스트 ──────────────────────────────────────────────

def test_normalize_api_url_maps_legacy_host():
    assert normalize_api_url("https://k14b105.p.ssafy.io") == "https://ssafer.co.kr"
    assert normalize_api_url("https://k14b105.p.ssafy.io/") == "https://ssafer.co.kr"


def test_save_auth_tokens_stores_normalized_endpoint(monkeypatch, tmp_path):
    config_path = tmp_path / "config.yml"
    monkeypatch.setattr(auth_module, "CONFIG_PATH", config_path)
    save_auth_tokens({"accessToken": "access-token"}, endpoint="https://k14b105.p.ssafy.io")

    assert load_endpoint() == "https://ssafer.co.kr"


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

    def fake_upload_last_scan(
        path: Path,
        api_url: str | None = None,
        token: str | None = None,
        on_step=None,
    ):
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
