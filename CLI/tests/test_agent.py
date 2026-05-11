from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from typer.testing import CliRunner

from ssafer.core import agent
from ssafer.main import app


def test_build_agent_ws_url_uses_ws_path():
    assert (
        agent.build_agent_ws_url("https://k14b105.p.ssafy.io")
        == "wss://ssafer.co.kr/ws/v1/internal/agents/connect"
    )
    assert (
        agent.build_agent_ws_url("https://ssafer.co.kr")
        == "wss://ssafer.co.kr/ws/v1/internal/agents/connect"
    )
    assert (
        agent.build_agent_ws_url("http://localhost:8080/api")
        == "ws://localhost:8080/ws/v1/internal/agents/connect"
    )


def test_fetch_pending_agent_tasks_parses_backend_response(monkeypatch):
    requests = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "data": [
                    {
                        "taskId": 10,
                        "taskType": "PATCH_APPLY",
                        "taskStatus": "PENDING",
                        "projectId": 1,
                        "scanId": 2,
                        "findingId": 3,
                        "payload": {"patches": []},
                    }
                ]
            }

    class FakeClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url, headers):
            requests.append((url, headers))
            return FakeResponse()

    monkeypatch.setattr(agent.httpx, "Client", FakeClient)

    tasks = agent.fetch_pending_agent_tasks("https://example.com", 7, "agent-token")

    assert requests == [
        (
            "https://example.com/api/v1/internal/agents/7/tasks",
            {"Authorization": "Bearer agent-token"},
        )
    ]
    assert tasks[0].task_id == 10
    assert tasks[0].task_type == "PATCH_APPLY"
    assert tasks[0].payload == {"patches": []}


def test_handle_agent_task_applies_patch_payload(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=3,
        payload={
            "patches": [
                {
                    "patchId": "PATCH-1",
                    "filePath": "Dockerfile",
                    "oldText": "USER root",
                    "newText": "USER appuser",
                }
            ]
        },
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "SUCCESS"
    assert result.patch_results[0].patch_id == "PATCH-1"
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_handle_agent_task_fails_invalid_patch_apply_payload(tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=3,
        payload={"patches": [{"patchId": "PATCH-1", "filePath": "Dockerfile", "newText": "USER appuser"}]},
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "FAILED"
    assert "no applicable patch" in result.message
    assert result.patch_results == []


def test_handle_agent_task_returns_failed_when_patch_apply_fails(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=3,
        payload={
            "patches": [
                {
                    "patchId": "PATCH-1",
                    "filePath": "Dockerfile",
                    "oldText": "USER missing",
                    "newText": "USER appuser",
                }
            ]
        },
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "FAILED"
    assert "oldText was not found" in result.message
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER root\n"


def test_handle_agent_task_skips_non_patch_task(tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload=None,
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "SKIPPED"


def test_agent_watch_command_uses_env_defaults(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)
        kwargs["on_event"]("connected", "ok")
        kwargs["on_event"]("checking_tasks", None)
        kwargs["on_event"]("tasks_found", [])

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://example.com"
    assert calls[0]["agent_id"] == 7
    assert calls[0]["project_id"] == 3
    assert calls[0]["agent_token"] == "agent-token"
    assert calls[0]["reconnect"] is True
    assert "Starting local agent." in result.output
    assert "Checking pending tasks..." in result.output
    assert "No pending tasks." in result.output


def test_agent_watch_command_uses_saved_agent_config(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)

    monkeypatch.delenv("SSAFER_AGENT_ID", raising=False)
    monkeypatch.delenv("SSAFER_PROJECT_ID", raising=False)
    monkeypatch.delenv("SSAFER_AGENT_TOKEN", raising=False)
    monkeypatch.setattr(
        "ssafer.core.auth.load_agent_config",
        lambda: {
            "endpoint": "https://api.example.com",
            "agentId": 3,
            "projectId": 10,
            "agentToken": "raw-agent-token",
        },
    )
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://api.example.com"
    assert calls[0]["agent_id"] == 3
    assert calls[0]["project_id"] == 10
    assert calls[0]["agent_token"] == "raw-agent-token"


def test_agent_command_starts_with_saved_agent_config(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)

    monkeypatch.delenv("SSAFER_AGENT_ID", raising=False)
    monkeypatch.delenv("SSAFER_PROJECT_ID", raising=False)
    monkeypatch.delenv("SSAFER_AGENT_TOKEN", raising=False)
    monkeypatch.setattr(
        "ssafer.core.auth.load_agent_config",
        lambda: {
            "endpoint": "https://api.example.com",
            "agentId": 3,
            "projectId": 10,
            "agentToken": "raw-agent-token",
        },
    )
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent", "--path", str(tmp_path)])

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://api.example.com"
    assert calls[0]["agent_id"] == 3
    assert calls[0]["project_id"] == 10
    assert calls[0]["agent_token"] == "raw-agent-token"
    assert calls[0]["once"] is False
    assert calls[0]["reconnect"] is True
    assert "Starting local agent." in result.output


def test_agent_command_initializes_missing_agent_config(monkeypatch, tmp_path: Path):
    calls = []
    captured = {}

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)

    def fake_issue(endpoint: str, project_id: int, access_token: str):
        captured["issue"] = {
            "endpoint": endpoint,
            "project_id": project_id,
            "access_token": access_token,
        }
        return {"agentId": 9, "projectId": project_id, "agentToken": "new-agent-token"}

    def fake_save(agent_data: dict, endpoint: str | None = None):
        captured["save"] = {
            "agent_data": agent_data,
            "endpoint": endpoint,
        }

    monkeypatch.delenv("SSAFER_AGENT_ID", raising=False)
    monkeypatch.delenv("SSAFER_PROJECT_ID", raising=False)
    monkeypatch.delenv("SSAFER_AGENT_TOKEN", raising=False)
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://api.example.com")
    monkeypatch.setattr("ssafer.core.auth.load_token", lambda: "access-token")
    monkeypatch.setattr(
        "ssafer.core.auth.list_projects",
        lambda endpoint, access_token: [
            {"projectId": 10, "name": "first-project"},
            {"projectId": 20, "name": "second-project"},
        ],
    )
    monkeypatch.setattr("ssafer.core.auth.issue_project_agent_token", fake_issue)
    monkeypatch.setattr("ssafer.core.auth.save_agent_config", fake_save)
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent", "--path", str(tmp_path)], input="1\n")

    assert result.exit_code == 0
    assert captured["issue"] == {
        "endpoint": "https://api.example.com",
        "project_id": 10,
        "access_token": "access-token",
    }
    assert captured["save"] == {
        "agent_data": {"agentId": 9, "projectId": 10, "agentToken": "new-agent-token"},
        "endpoint": "https://api.example.com",
    }
    assert calls[0]["agent_id"] == 9
    assert calls[0]["project_id"] == 10
    assert calls[0]["agent_token"] == "new-agent-token"
    assert "first-project (projectId=10)" in result.output
    assert "Agent setup complete." in result.output


def test_agent_watch_command_prints_pending_task_count(monkeypatch, tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="PENDING",
        project_id=3,
        scan_id=2,
        finding_id=1,
        payload={"patches": []},
    )

    async def fake_watch_agent(**kwargs):
        kwargs["on_event"]("tasks_found", [task])

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert "Found 1 pending task(s)." in result.output
    assert "PATCH_APPLY" in result.output


def test_agent_watch_command_prints_dry_run_and_task_result_table(monkeypatch, tmp_path: Path):
    async def fake_watch_agent(**kwargs):
        kwargs["on_event"](
            "task",
            agent.AgentTaskResult(
                task_id=10,
                task_type="PATCH_APPLY",
                status="DRY_RUN",
                message="Applied 1 patch candidate(s).",
                patch_results=[],
            ),
        )

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once", "--dry-run"])

    assert result.exit_code == 0
    assert "Dry-run mode: files will not be modified." in result.output
    assert "Agent task #10 result" in result.output
    assert "PATCH_APPLY" in result.output
    assert "DRY_RUN" in result.output


def test_agent_watch_command_passes_reconnect_options(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)
        kwargs["on_event"]("disconnected", {"attempt": 1, "error": "closed"})
        kwargs["on_event"]("reconnecting", {"attempt": 1, "delaySeconds": 1})

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(
        app,
        [
            "agent-watch",
            "--path",
            str(tmp_path),
            "--max-retries",
            "3",
            "--reconnect-max-delay",
            "9",
        ],
    )

    assert result.exit_code == 0
    assert calls[0]["reconnect"] is True
    assert calls[0]["max_retries"] == 3
    assert calls[0]["reconnect_max_delay_seconds"] == 9
    assert "Agent connection lost." in result.output
    assert "Reconnecting agent..." in result.output


def test_watch_agent_reconnects_after_connection_drop(monkeypatch, tmp_path: Path):
    events = []
    calls = {"count": 0}

    async def fake_session(**kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("websocket closed")

    async def fake_sleep(delay: float):
        events.append(("sleep", delay))

    monkeypatch.setitem(sys.modules, "websockets", SimpleNamespace())
    monkeypatch.setattr(agent, "_watch_agent_session", fake_session)
    monkeypatch.setattr(agent.asyncio, "sleep", fake_sleep)

    async def run_watch():
        await agent.watch_agent(
            api_url="https://example.com",
            agent_id=7,
            project_id=3,
            agent_token="agent-token",
            project_root=tmp_path,
            interval_seconds=5,
            once=False,
            dry_run=False,
            reconnect=True,
            max_retries=2,
            reconnect_max_delay_seconds=30,
            on_event=lambda event_type, payload: events.append((event_type, payload)),
        )

    import asyncio

    asyncio.run(run_watch())

    assert calls["count"] == 2
    assert events[0][0] == "disconnected"
    assert events[1][0] == "reconnecting"
    assert events[2] == ("sleep", 1)


def test_watch_agent_once_does_not_reconnect(monkeypatch, tmp_path: Path):
    calls = {"count": 0}

    async def fake_session(**kwargs):
        calls["count"] += 1
        raise RuntimeError("websocket closed")

    monkeypatch.setitem(sys.modules, "websockets", SimpleNamespace())
    monkeypatch.setattr(agent, "_watch_agent_session", fake_session)

    async def run_watch():
        await agent.watch_agent(
            api_url="https://example.com",
            agent_id=7,
            project_id=3,
            agent_token="agent-token",
            project_root=tmp_path,
            interval_seconds=5,
            once=True,
            dry_run=False,
            reconnect=True,
            max_retries=2,
            reconnect_max_delay_seconds=30,
            on_event=lambda event_type, payload: None,
        )

    import asyncio

    try:
        asyncio.run(run_watch())
    except RuntimeError as exc:
        assert str(exc) == "websocket closed"
    else:
        raise AssertionError("watch_agent should raise when --once connection drops")

    assert calls["count"] == 1
