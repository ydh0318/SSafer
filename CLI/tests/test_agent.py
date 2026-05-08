from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from ssafer.core import agent
from ssafer.main import app


def test_build_agent_ws_url_uses_ws_path():
    assert (
        agent.build_agent_ws_url("https://k14b105.p.ssafy.io")
        == "wss://k14b105.p.ssafy.io/ws/v1/internal/agents/connect"
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
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://example.com"
    assert calls[0]["agent_id"] == 7
    assert calls[0]["project_id"] == 3
    assert calls[0]["agent_token"] == "agent-token"
    assert "Starting local agent." in result.output
    assert "Checking pending tasks..." in result.output
    assert "No pending tasks." in result.output


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
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once", "--dry-run"])

    assert result.exit_code == 0
    assert "Dry-run mode: files will not be modified." in result.output
    assert "Agent task #10 result" in result.output
    assert "PATCH_APPLY" in result.output
    assert "DRY_RUN" in result.output
