from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from typer.testing import CliRunner

from ssafer.core import agent
from ssafer.core.hashing import hash_file
from ssafer.main import app
from ssafer.server.audit import ServerAuditResult


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


def test_report_agent_task_result_posts_backend_payload(monkeypatch, tmp_path: Path):
    requests = []
    backup = tmp_path / "Dockerfile.20260511120000.bak"
    backup.write_text("FROM alpine\nUSER root\n", encoding="utf-8")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": {"taskId": 10, "taskStatus": "SUCCEEDED", "findingId": 3}}

    class FakeClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def post(self, url, headers, json):
            requests.append((url, headers, json, self.kwargs))
            return FakeResponse()

    monkeypatch.setattr(agent.httpx, "Client", FakeClient)
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="SENT",
        project_id=1,
        scan_id=2,
        finding_id=3,
        payload={"patches": []},
    )
    result = agent.AgentTaskResult(
        task_id=10,
        task_type="PATCH_APPLY",
        status="SUCCESS",
        message="Applied 1 patch candidate(s).",
        patch_results=[
            agent.PatchApplyResult(
                patch_id="PATCH-1",
                finding_id="3",
                file_path="Dockerfile",
                status="SUCCESS",
                message="Patch applied successfully.",
                backup_path=str(backup),
            )
        ],
    )

    report = agent.report_agent_task_result("https://api.example.com", 7, "agent-token", task, result)

    assert report == {"data": {"taskId": 10, "taskStatus": "SUCCEEDED", "findingId": 3}}
    assert requests == [
        (
            "https://api.example.com/api/v1/internal/agents/7/tasks/10/result",
            {"Authorization": "Bearer agent-token"},
            {
                "taskStatus": "SUCCEEDED",
                "resultMessage": "Applied 1 patch candidate(s).",
                "patchResults": [
                    {
                        "patchId": "PATCH-1",
                        "filePath": "Dockerfile",
                        "status": "SUCCESS",
                        "message": "Patch applied successfully.",
                        "backupPath": str(backup),
                    }
                ],
            },
            {"timeout": 20.0, "follow_redirects": True},
        )
    ]


def test_report_agent_task_result_reports_task_failure(monkeypatch):
    requests = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": {"taskId": 10, "taskStatus": "FAILED", "findingId": 3}}

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def post(self, url, headers, json):
            requests.append((url, headers, json))
            return FakeResponse()

    monkeypatch.setattr(agent.httpx, "Client", FakeClient)
    task = agent.AgentTask(
        task_id=10,
        task_type="PATCH_APPLY",
        task_status="SENT",
        project_id=1,
        scan_id=2,
        finding_id=3,
        payload={"patches": []},
    )
    result = agent.AgentTaskResult(
        task_id=10,
        task_type="PATCH_APPLY",
        status="FAILED",
        message="Patch oldText was not found: Dockerfile",
        patch_results=[],
    )

    agent.report_agent_task_result("https://api.example.com", 7, "agent-token", task, result)

    assert requests == [
        (
            "https://api.example.com/api/v1/internal/agents/7/tasks/10/result",
            {"Authorization": "Bearer agent-token"},
            {
                "taskStatus": "FAILED",
                "resultMessage": "Patch oldText was not found: Dockerfile",
                "patchResults": [],
            },
        )
    ]


def test_report_agent_task_result_reports_scan_request_result(monkeypatch):
    requests = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": {"taskId": 11, "taskStatus": "FAILED"}}

    class FakeClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def post(self, url, headers, json):
            requests.append((url, headers, json, self.kwargs))
            return FakeResponse()

    monkeypatch.setattr(agent.httpx, "Client", FakeClient)
    task = agent.AgentTask(
        task_id=11,
        task_type="SCAN_REQUEST",
        task_status="SENT",
        project_id=1,
        scan_id=22,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw"},
    )
    result = agent.AgentTaskResult(
        task_id=11,
        task_type="SCAN_REQUEST",
        status="FAILED",
        message="SCAN_REQUEST failed: backend returned 409.",
        patch_results=[],
    )

    report = agent.report_agent_task_result("https://api.example.com", 7, "agent-token", task, result)

    assert report == {"data": {"taskId": 11, "taskStatus": "FAILED"}}
    assert requests == [
        (
            "https://api.example.com/api/v1/internal/agents/7/tasks/11/result",
            {"Authorization": "Bearer agent-token"},
            {
                "taskStatus": "FAILED",
                "resultMessage": "SCAN_REQUEST failed: backend returned 409.",
                "patchResults": [],
            },
            {"timeout": 20.0, "follow_redirects": True},
        )
    ]


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


def test_handle_agent_task_applies_patch_when_hash_changed_but_old_text_is_unique(tmp_path: Path):
    target = tmp_path / "docker-compose.yml"
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "    ports:\n"
        "      - \"5432:5432\"\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    expected_hash = hash_file(target)
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
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
                    "patchId": "PATCH-2",
                    "filePath": "docker-compose.yml",
                    "oldText": "    ports:\n      - \"6379:6379\"",
                    "newText": "",
                    "expectedFileHash": expected_hash,
                }
            ]
        },
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "SUCCESS"
    assert result.patch_results[0].patch_id == "PATCH-2"
    assert "6379:6379" not in target.read_text(encoding="utf-8")


def test_handle_agent_task_fails_scan_request_without_upload_url(tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawResultPath": "s3://ssafer/raw/2/result.json"},
    )

    result = agent.handle_agent_task(tmp_path, task)

    assert result.status == "FAILED"
    assert "rawUploadUrl" in result.message


def test_handle_agent_task_runs_scan_request_and_uploads_result(monkeypatch, tmp_path: Path):
    calls = {}
    scan_payload = {"scanId": "local-id", "projectName": "sample", "findings": []}

    def fake_run_scan(project_root: Path, *, save_raw: bool = False, on_step=None):
        calls["run_scan"] = {"project_root": project_root, "save_raw": save_raw}
        return scan_payload

    def fake_upload_scan_result_to_registered_scan(
        project_root,
        scan,
        *,
        api_url,
        token,
        scan_id,
        raw_upload_url,
        on_step=None,
    ):
        calls["upload"] = {
            "project_root": project_root,
            "scan": scan,
            "api_url": api_url,
            "token": token,
            "scan_id": scan_id,
            "raw_upload_url": raw_upload_url,
            "on_step": on_step,
        }
        if on_step is not None:
            on_step("uploading")
        return {"scanId": scan_id, "status": "RAW_UPLOADED"}

    monkeypatch.setattr(agent, "run_scan", fake_run_scan)
    monkeypatch.setattr(agent, "upload_scan_result_to_registered_scan", fake_upload_scan_result_to_registered_scan)

    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={
            "rawUploadUrl": "https://s3.example.com/raw",
            "scanType": "PROJECT_FILE",
            "targetPath": ".",
            "saveRaw": True,
        },
    )

    steps: list[str] = []
    result = agent.handle_agent_task(
        tmp_path,
        task,
        api_url="https://api.example.com",
        agent_token="agent-token",
        upload_token="access-token",
        on_step=steps.append,
    )

    assert result.status == "SUCCESS"
    assert calls["run_scan"] == {"project_root": tmp_path.resolve(), "save_raw": True}
    assert calls["upload"] == {
        "project_root": tmp_path.resolve(),
        "scan": scan_payload,
        "api_url": "https://api.example.com",
        "token": "access-token",
        "scan_id": 2,
        "raw_upload_url": "https://s3.example.com/raw",
        "on_step": steps.append,
    }
    assert steps == ["uploading"]


def test_handle_agent_task_runs_server_audit_request_and_uploads_result(monkeypatch, tmp_path: Path):
    calls = {}

    def fake_run_server_audit(*, checks=None, include_os_packages=False, allow_sudo=False):
        calls["server_audit"] = {
            "checks": checks,
            "include_os_packages": include_os_packages,
            "allow_sudo": allow_sudo,
        }
        return ServerAuditResult()

    def fake_upload_scan_result_to_registered_scan(
        project_root,
        scan,
        *,
        api_url,
        token,
        scan_id,
        raw_upload_url,
        on_step=None,
    ):
        calls["upload"] = {
            "project_root": project_root,
            "scan": scan,
            "api_url": api_url,
            "token": token,
            "scan_id": scan_id,
            "raw_upload_url": raw_upload_url,
            "on_step": on_step,
        }
        return {"scanId": scan_id, "status": "RAW_UPLOADED"}

    monkeypatch.setattr(agent, "run_server_audit", fake_run_server_audit)
    monkeypatch.setattr(agent, "upload_scan_result_to_registered_scan", fake_upload_scan_result_to_registered_scan)

    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={
            "rawUploadUrl": "https://s3.example.com/raw",
            "scanType": "SERVER_AUDIT",
            "checks": ["ports", "docker"],
            "includeOsPackages": True,
            "allowSudo": "true",
        },
    )

    result = agent.handle_agent_task(
        tmp_path,
        task,
        api_url="https://api.example.com",
        agent_token="agent-token",
        upload_token="access-token",
    )

    assert result.status == "SUCCESS"
    assert calls["server_audit"] == {
        "checks": ["ports", "docker"],
        "include_os_packages": True,
        "allow_sudo": True,
    }
    assert calls["upload"]["project_root"] == tmp_path
    assert calls["upload"]["scan"]["source"] == "server-audit"
    assert calls["upload"]["scan"]["scanType"] == "SERVER_AUDIT"
    assert calls["upload"]["api_url"] == "https://api.example.com"
    assert calls["upload"]["token"] == "access-token"
    assert calls["upload"]["scan_id"] == 2
    assert calls["upload"]["raw_upload_url"] == "https://s3.example.com/raw"


def test_handle_agent_task_rejects_scan_request_without_upload_token(monkeypatch, tmp_path: Path):
    def fail_run_scan(*args, **kwargs):
        raise AssertionError("run_scan should not be called without an upload token")

    monkeypatch.setattr(agent, "run_scan", fail_run_scan)
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw", "targetPath": "."},
    )

    result = agent.handle_agent_task(
        tmp_path,
        task,
        api_url="https://api.example.com",
        agent_token="agent-token",
    )

    assert result.status == "FAILED"
    assert "login or guest token" in result.message


def test_process_agent_tasks_emits_scan_request_step(monkeypatch, tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw"},
    )
    events: list[tuple[str, object]] = []

    def fake_handle_agent_task(*args, on_step=None, **kwargs):
        assert on_step is not None
        on_step("uploading")
        return agent.AgentTaskResult(
            task_id=10,
            task_type="SCAN_REQUEST",
            status="SUCCESS",
            message="done",
            patch_results=[],
            scan_id=2,
        )

    monkeypatch.setattr(agent, "handle_agent_task", fake_handle_agent_task)

    agent._process_agent_tasks(
        api_url="https://api.example.com",
        agent_id=1,
        agent_token="agent-token",
        project_root=tmp_path,
        dry_run=True,
        on_event=lambda event_type, payload: events.append((event_type, payload)),
        upload_token="access-token",
        tasks=[task],
    )

    assert ("task_step", {"taskId": 10, "taskType": "SCAN_REQUEST", "scanId": 2, "message": "uploading"}) in events


def test_process_agent_tasks_waits_for_scan_analysis_after_result_report(monkeypatch, tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw"},
    )
    events: list[tuple[str, object]] = []
    statuses = iter([
        {"scanId": 2, "status": "ANALYZING", "progressStep": "EXPLAIN"},
        {"scanId": 2, "status": "DONE", "progressStep": "ANALYSIS_RESULT_SAVED"},
    ])

    monkeypatch.setattr(
        agent,
        "handle_agent_task",
        lambda *args, **kwargs: agent.AgentTaskResult(
            task_id=10,
            task_type="SCAN_REQUEST",
            status="SUCCESS",
            message="done",
            patch_results=[],
            scan_id=2,
        ),
    )
    monkeypatch.setattr(agent, "report_agent_task_result", lambda *args, **kwargs: {"taskId": 10})
    monkeypatch.setattr(agent, "fetch_scan_status", lambda api_url, scan_id, token: next(statuses))
    monkeypatch.setattr(agent, "_sleep", lambda seconds: None)

    agent._process_agent_tasks(
        api_url="https://api.example.com",
        agent_id=1,
        agent_token="agent-token",
        project_root=tmp_path,
        dry_run=False,
        on_event=lambda event_type, payload: events.append((event_type, payload)),
        upload_token="access-token",
        tasks=[task],
    )

    event_types = [event_type for event_type, _ in events]
    assert event_types == [
        "task",
        "task_result_reported",
        "analysis_wait_started",
        "analysis_status",
        "analysis_done",
    ]


def test_handle_agent_task_dry_runs_scan_request_without_running_scan(monkeypatch, tmp_path: Path):
    def fail_run_scan(*args, **kwargs):
        raise AssertionError("run_scan should not be called in dry-run")

    monkeypatch.setattr(agent, "run_scan", fail_run_scan)
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw", "targetPath": "."},
    )

    result = agent.handle_agent_task(tmp_path, task, dry_run=True, api_url="https://api.example.com")

    assert result.status == "DRY_RUN"
    assert "validated" in result.message


def test_handle_agent_task_rejects_scan_request_outside_agent_root(tmp_path: Path):
    outside = tmp_path.parent
    task = agent.AgentTask(
        task_id=10,
        task_type="SCAN_REQUEST",
        task_status="PENDING",
        project_id=1,
        scan_id=2,
        finding_id=None,
        payload={"rawUploadUrl": "https://s3.example.com/raw", "targetPath": str(outside)},
    )

    result = agent.handle_agent_task(tmp_path, task, api_url="https://api.example.com")

    assert result.status == "FAILED"
    assert "inside the agent project root" in result.message


def test_handle_agent_task_skips_unknown_task(tmp_path: Path):
    task = agent.AgentTask(
        task_id=10,
        task_type="UNKNOWN",
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
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://example.com"
    assert calls[0]["agent_id"] == 7
    assert calls[0]["project_id"] == 3
    assert calls[0]["agent_token"] == "agent-token"
    assert calls[0]["reconnect"] is True
    assert "Local Agent 실행 중" in result.output
    assert "Agent 연결 완료" in result.output
    assert "처리할 pending task가 없습니다" in result.output


def test_agent_watch_command_uses_saved_agent_config(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)

    monkeypatch.delenv("SSAFER_AGENT_ID", raising=False)
    monkeypatch.delenv("SSAFER_PROJECT_ID", raising=False)
    monkeypatch.delenv("SSAFER_AGENT_TOKEN", raising=False)
    monkeypatch.setattr(
        "ssafer.core.auth.load_agent_config",
        lambda *args, **kwargs: {
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
        lambda *args, **kwargs: {
            "endpoint": "https://api.example.com",
            "agentId": 3,
            "projectId": 10,
            "agentToken": "raw-agent-token",
        },
    )
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://api.example.com")
    monkeypatch.setattr("ssafer.core.auth.load_token", lambda: "access-token")
    monkeypatch.setattr(
        "ssafer.core.auth.list_projects",
        lambda endpoint, token: [{"projectId": 10, "name": "Saved project"}],
    )
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent", "--path", str(tmp_path)], input="\n")

    assert result.exit_code == 0
    assert calls[0]["api_url"] == "https://api.example.com"
    assert calls[0]["agent_id"] == 3
    assert calls[0]["project_id"] == 10
    assert calls[0]["agent_token"] == "raw-agent-token"
    assert calls[0]["once"] is False
    assert calls[0]["reconnect"] is True
    assert "Local Agent 실행 중" in result.output


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

    def fake_save(agent_data: dict, endpoint: str | None = None, project_root: Path | None = None):
        captured["save"] = {
            "agent_data": agent_data,
            "endpoint": endpoint,
            "project_root": project_root,
        }

    monkeypatch.delenv("SSAFER_AGENT_ID", raising=False)
    monkeypatch.delenv("SSAFER_PROJECT_ID", raising=False)
    monkeypatch.delenv("SSAFER_AGENT_TOKEN", raising=False)
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
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
        "project_root": tmp_path.resolve(),
    }
    assert calls[0]["agent_id"] == 9
    assert calls[0]["project_id"] == 10
    assert calls[0]["agent_token"] == "new-agent-token"
    assert "프로젝트 목록" in result.output
    assert "first-project" in result.output
    assert "10" in result.output
    assert "projectId=10" in result.output


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
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert "task 1" in result.output
    assert "PATCH_APPLY" in result.output


def test_agent_watch_command_summarizes_repeated_pending_task_types(monkeypatch, tmp_path: Path):
    tasks = [
        agent.AgentTask(
            task_id=index,
            task_type="SCAN_REQUEST",
            task_status="PENDING",
            project_id=3,
            scan_id=index,
            finding_id=None,
            payload={"rawUploadUrl": "https://s3.example.com/raw"},
        )
        for index in range(1, 4)
    ]

    async def fake_watch_agent(**kwargs):
        kwargs["on_event"]("tasks_found", tasks)

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert "task 3" in result.output
    assert "SCAN_REQUEST 3" in result.output
    assert "SCAN_REQUEST, SCAN_REQUEST" not in result.output


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
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once", "--dry-run"])

    assert result.exit_code == 0
    assert "Dry-run" in result.output
    assert "Agent task #10 result" in result.output
    assert "PATCH_APPLY" in result.output
    assert "DRY_RUN" in result.output


def test_agent_watch_command_summarizes_scan_request_raw_results_conflict(monkeypatch, tmp_path: Path):
    async def fake_watch_agent(**kwargs):
        kwargs["on_event"](
            "task",
            agent.AgentTaskResult(
                task_id=10,
                task_type="SCAN_REQUEST",
                status="FAILED",
                message=(
                    "SCAN_REQUEST failed: Client error '409 ' for url "
                    "'https://ssafer.co.kr/api/v1/scans/13/raw-results'\n"
                    "For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409"
                ),
                patch_results=[],
            ),
        )

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
    monkeypatch.setattr("ssafer.core.auth.load_endpoint", lambda: "https://example.com")
    monkeypatch.setattr("ssafer.core.agent.watch_agent", fake_watch_agent)

    result = CliRunner().invoke(app, ["agent-watch", "--path", str(tmp_path), "--once"])

    assert result.exit_code == 0
    assert "Agent scan task #10 result" in result.output
    assert "Scan ID" in result.output
    assert "Scan Type" in result.output
    assert "Patch ID" not in result.output
    assert "scanId=13" in result.output
    assert "409" in result.output
    assert "developer.mozilla.org" not in result.output


def test_agent_watch_command_passes_reconnect_options(monkeypatch, tmp_path: Path):
    calls = []

    async def fake_watch_agent(**kwargs):
        calls.append(kwargs)
        kwargs["on_event"]("disconnected", {"attempt": 1, "error": "closed"})
        kwargs["on_event"]("reconnecting", {"attempt": 1, "delaySeconds": 1})

    monkeypatch.setenv("SSAFER_AGENT_ID", "7")
    monkeypatch.setenv("SSAFER_PROJECT_ID", "3")
    monkeypatch.setenv("SSAFER_AGENT_TOKEN", "agent-token")
    monkeypatch.setattr("ssafer.core.auth.load_agent_config", lambda *args, **kwargs: {})
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
    assert "Agent 연결이 끊겼습니다" in result.output
    assert "Reconnecting agent..." not in result.output


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


def test_watch_agent_does_not_reconnect_on_agent_auth_error(monkeypatch, tmp_path: Path):
    events = []
    calls = {"count": 0}

    async def fake_session(**kwargs):
        calls["count"] += 1
        request = agent.httpx.Request("GET", "https://api.example.com/api/v1/internal/agents/7/tasks")
        response = agent.httpx.Response(401, request=request)
        raise agent.httpx.HTTPStatusError("unauthorized", request=request, response=response)

    async def fail_sleep(delay: float):
        raise AssertionError("auth failure should not reconnect")

    monkeypatch.setitem(sys.modules, "websockets", SimpleNamespace())
    monkeypatch.setattr(agent, "_watch_agent_session", fake_session)
    monkeypatch.setattr(agent.asyncio, "sleep", fail_sleep)

    async def run_watch():
        await agent.watch_agent(
            api_url="https://example.com",
            agent_id=7,
            project_id=3,
            agent_token="bad-agent-token",
            project_root=tmp_path,
            interval_seconds=5,
            once=False,
            dry_run=False,
            reconnect=True,
            max_retries=None,
            reconnect_max_delay_seconds=30,
            on_event=lambda event_type, payload: events.append((event_type, payload)),
        )

    import asyncio

    try:
        asyncio.run(run_watch())
    except agent.httpx.HTTPStatusError:
        pass
    else:
        raise AssertionError("watch_agent should raise auth failure")

    assert calls["count"] == 1
    assert events[0][0] == "auth_failed"


def test_tasks_from_ws_message_parses_task_assigned():
    tasks = agent._tasks_from_ws_message(
        '{"type":"TASK_ASSIGNED","taskId":10,"taskType":"SCAN_REQUEST","projectId":1,"scanId":2,'
        '"payload":{"targetPath":"."}}'
    )

    assert tasks is not None
    assert len(tasks) == 1
    assert tasks[0].task_id == 10
    assert tasks[0].task_type == "SCAN_REQUEST"
    assert tasks[0].task_status == "SENT"
    assert tasks[0].payload == {"targetPath": "."}


def test_tasks_from_ws_message_requests_fetch_on_task_available():
    assert agent._tasks_from_ws_message('{"type":"TASK_AVAILABLE"}') is None


def test_watch_agent_session_fetches_on_connect_and_task_available(monkeypatch, tmp_path: Path):
    events = []
    fetch_calls = []

    class FakeWebSocket:
        def __init__(self):
            self.messages = [
                '{"type":"CONNECTED"}',
                '{"type":"TASK_AVAILABLE"}',
            ]

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def send(self, message):
            return None

        async def recv(self):
            if self.messages:
                return self.messages.pop(0)
            raise RuntimeError("stop")

    def fake_connect(*args, **kwargs):
        return FakeWebSocket()

    def fake_fetch(api_url: str, agent_id: int, agent_token: str):
        fetch_calls.append((api_url, agent_id, agent_token))
        return []

    monkeypatch.setattr(agent, "fetch_pending_agent_tasks", fake_fetch)

    async def run_session():
        await agent._watch_agent_session(
            websockets=SimpleNamespace(connect=fake_connect),
            ws_url="wss://example.com/ws/v1/internal/agents/connect",
            headers={"Authorization": "Bearer agent-token"},
            api_url="https://api.example.com",
            agent_id=7,
            project_id=3,
            agent_token="agent-token",
            project_root=tmp_path,
            interval_seconds=5,
            once=False,
            dry_run=False,
            on_event=lambda event_type, payload: events.append((event_type, payload)),
        )

    import asyncio

    try:
        asyncio.run(run_session())
    except RuntimeError as exc:
        assert str(exc) == "stop"
    else:
        raise AssertionError("fake websocket should stop the session")

    assert fetch_calls == [
        ("https://api.example.com", 7, "agent-token"),
        ("https://api.example.com", 7, "agent-token"),
    ]
    assert [event[0] for event in events].count("checking_tasks") == 2
    assert "task_available" in [event[0] for event in events]


def test_watch_agent_session_sends_heartbeat_ping(monkeypatch, tmp_path: Path):
    events = []
    sent_messages = []

    class FakeWebSocket:
        def __init__(self):
            self.connected = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def send(self, message):
            sent_messages.append(message)
            if '"type": "PING"' in message:
                raise RuntimeError("stop")

        async def recv(self):
            if not self.connected:
                self.connected = True
                return '{"type":"CONNECTED"}'
            await asyncio.sleep(0.2)
            return '{"type":"IGNORED"}'

    def fake_connect(*args, **kwargs):
        return FakeWebSocket()

    monkeypatch.setattr(agent, "fetch_pending_agent_tasks", lambda *args, **kwargs: [])

    async def run_session():
        await agent._watch_agent_session(
            websockets=SimpleNamespace(connect=fake_connect),
            ws_url="wss://example.com/ws/v1/internal/agents/connect",
            headers={"Authorization": "Bearer agent-token"},
            api_url="https://api.example.com",
            agent_id=7,
            project_id=3,
            agent_token="agent-token",
            project_root=tmp_path,
            interval_seconds=0.01,
            once=False,
            dry_run=False,
            on_event=lambda event_type, payload: events.append((event_type, payload)),
        )

    import asyncio

    try:
        asyncio.run(run_session())
    except RuntimeError as exc:
        assert str(exc) == "stop"
    else:
        raise AssertionError("fake websocket should stop after heartbeat")

    assert any('"type": "CONNECT"' in message for message in sent_messages)
    assert any('"type": "PING"' in message for message in sent_messages)
    assert "ping" in [event[0] for event in events]


def test_watch_agent_session_fallback_polls_when_ws_task_event_is_missing(monkeypatch, tmp_path: Path):
    events = []
    fetch_calls = []
    sent_messages = []
    monotonic_values = iter([0.0, 10.0, 31.0])

    class FakeWebSocket:
        def __init__(self):
            self.connected = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def send(self, message):
            sent_messages.append(message)
            if '"type": "PING"' in message and len([sent for sent in sent_messages if '"type": "PING"' in sent]) >= 3:
                raise RuntimeError("stop")

        async def recv(self):
            if not self.connected:
                self.connected = True
                return '{"type":"CONNECTED"}'
            await asyncio.sleep(0.2)
            return '{"type":"IGNORED"}'

    def fake_connect(*args, **kwargs):
        return FakeWebSocket()

    def fake_fetch(api_url: str, agent_id: int, agent_token: str):
        fetch_calls.append((api_url, agent_id, agent_token))
        return []

    monkeypatch.setattr(agent, "_monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(agent, "fetch_pending_agent_tasks", fake_fetch)

    async def run_session():
        await agent._watch_agent_session(
            websockets=SimpleNamespace(connect=fake_connect),
            ws_url="wss://example.com/ws/v1/internal/agents/connect",
            headers={"Authorization": "Bearer agent-token"},
            api_url="https://api.example.com",
            agent_id=7,
            project_id=3,
            agent_token="agent-token",
            project_root=tmp_path,
            interval_seconds=0.01,
            once=False,
            dry_run=False,
            on_event=lambda event_type, payload: events.append((event_type, payload)),
        )

    import asyncio

    try:
        asyncio.run(run_session())
    except RuntimeError as exc:
        assert str(exc) == "stop"
    else:
        raise AssertionError("fake websocket should stop after fallback polling")

    assert fetch_calls == [
        ("https://api.example.com", 7, "agent-token"),
        ("https://api.example.com", 7, "agent-token"),
    ]
    assert [event[0] for event in events].count("checking_tasks") == 2
