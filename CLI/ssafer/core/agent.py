from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import monotonic as _monotonic
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx

from ssafer.core.auth import normalize_api_url
from ssafer.core.patches import PatchApplyResult, PatchError, apply_patch_candidates, extract_patch_candidates
from ssafer.core.result_store import run_scan
from ssafer.core.upload import upload_scan_result_to_registered_scan
from ssafer.server.audit import run_server_audit

AGENT_FALLBACK_POLL_INTERVAL_SECONDS = 30.0


@dataclass(frozen=True)
class AgentTask:
    task_id: int
    task_type: str
    task_status: str
    project_id: int
    scan_id: int | None
    finding_id: int | None
    payload: dict[str, Any] | None


@dataclass(frozen=True)
class AgentTaskResult:
    task_id: int
    task_type: str
    status: str
    message: str
    patch_results: list[PatchApplyResult]
    scan_id: int | None = None
    scan_type: str | None = None


def build_agent_ws_url(api_url: str) -> str:
    parsed = urlparse(api_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    netloc = _agent_ws_netloc(parsed.netloc)
    return urlunparse((scheme, netloc, "/ws/v1/internal/agents/connect", "", "", ""))


def _agent_ws_netloc(netloc: str) -> str:
    if netloc == "k14b105.p.ssafy.io":
        return "ssafer.co.kr"
    return netloc


def fetch_pending_agent_tasks(api_url: str, agent_id: int, agent_token: str) -> list[AgentTask]:
    endpoint = f"{normalize_api_url(api_url)}/api/v1/internal/agents/{agent_id}/tasks"
    headers = {"Authorization": f"Bearer {agent_token}"}
    with httpx.Client(timeout=20.0, follow_redirects=True) as client:
        response = client.get(endpoint, headers=headers)
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    if not isinstance(data, list):
        return []
    return [_parse_agent_task(item) for item in data if isinstance(item, dict)]


def report_agent_task_result(
    api_url: str,
    agent_id: int,
    agent_token: str,
    task: AgentTask,
    result: AgentTaskResult,
) -> dict[str, Any] | None:
    if result.status == "DRY_RUN":
        return None
    if result.status not in {"SUCCESS", "FAILED"}:
        return None

    base_url = normalize_api_url(api_url)
    headers = {"Authorization": f"Bearer {agent_token}"}
    with httpx.Client(timeout=20.0, follow_redirects=True) as client:
        endpoint = f"{base_url}/api/v1/internal/agents/{agent_id}/tasks/{task.task_id}/result"
        payload = _build_agent_task_result_payload(result)
        response = client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


def handle_agent_task(
    project_root: Path,
    task: AgentTask,
    *,
    dry_run: bool = False,
    api_url: str | None = None,
    agent_token: str | None = None,
    upload_token: str | None = None,
) -> AgentTaskResult:
    if task.task_type == "SCAN_REQUEST":
        return _handle_scan_request_task(
            project_root,
            task,
            dry_run=dry_run,
            api_url=api_url,
            agent_token=agent_token,
            upload_token=upload_token,
        )

    if task.task_type != "PATCH_APPLY":
        return AgentTaskResult(
            task_id=task.task_id,
            task_type=task.task_type,
            status="SKIPPED",
            message=f"Unsupported agent task type: {task.task_type}",
            patch_results=[],
        )

    if task.payload is None:
        return AgentTaskResult(
            task_id=task.task_id,
            task_type=task.task_type,
            status="FAILED",
            message="PATCH_APPLY task has no payload.",
            patch_results=[],
        )

    candidates = extract_patch_candidates(task.payload)
    if not candidates:
        return AgentTaskResult(
            task_id=task.task_id,
            task_type=task.task_type,
            status="FAILED",
            message="PATCH_APPLY task payload has no applicable patch.",
            patch_results=[],
        )

    try:
        results = apply_patch_candidates(
            project_root,
            candidates,
            dry_run=dry_run,
            allow_hash_mismatch_if_text_matches=True,
        )
    except PatchError as exc:
        return AgentTaskResult(
            task_id=task.task_id,
            task_type=task.task_type,
            status="FAILED",
            message=str(exc),
            patch_results=[],
        )
    return AgentTaskResult(
        task_id=task.task_id,
        task_type=task.task_type,
        status="DRY_RUN" if dry_run else "SUCCESS",
        message=f"Applied {len(results)} patch candidate(s).",
        patch_results=results,
    )


def _handle_scan_request_task(
    project_root: Path,
    task: AgentTask,
    *,
    dry_run: bool,
    api_url: str | None,
    agent_token: str | None,
    upload_token: str | None,
) -> AgentTaskResult:
    if task.scan_id is None:
        return _failed_task(task, "SCAN_REQUEST task is missing scanId.")
    if task.payload is None:
        return _failed_task(task, "SCAN_REQUEST task has no payload.")

    raw_upload_url = _payload_string(task.payload, "rawUploadUrl", "raw_upload_url")
    if not raw_upload_url:
        if _payload_string(task.payload, "rawResultPath", "raw_result_path"):
            return _failed_task(
                task,
                "SCAN_REQUEST payload looks like an analysis dispatch task. Local scan execution requires rawUploadUrl.",
            )
        return _failed_task(task, "SCAN_REQUEST payload is missing rawUploadUrl.")

    if not api_url:
        return _failed_task(task, "SCAN_REQUEST handling requires api_url.")

    scan_type = (_payload_string(task.payload, "scanType", "scan_type") or "PROJECT_FILE").upper()
    if scan_type not in {"PROJECT_FILE", "PROJECT_SCAN", "LOCAL_SCAN", "SERVER_AUDIT"}:
        return _failed_task(task, f"Unsupported SCAN_REQUEST scanType: {scan_type}")

    target_root: Path | None = None
    if scan_type != "SERVER_AUDIT":
        try:
            target_root = _resolve_scan_root(project_root, task.payload)
        except ValueError as exc:
            return _failed_task(task, str(exc))

    if dry_run:
        target_label = "server runtime" if scan_type == "SERVER_AUDIT" else str(target_root)
        return AgentTaskResult(
            task_id=task.task_id,
            task_type=task.task_type,
            status="DRY_RUN",
            message=f"SCAN_REQUEST validated for {target_label}.",
            patch_results=[],
            scan_id=task.scan_id,
            scan_type=scan_type,
        )
    if not upload_token:
        return _failed_task(
            task,
            "SCAN_REQUEST upload callback requires a saved login or guest token. Run ssafer login first.",
        )

    try:
        if scan_type == "SERVER_AUDIT":
            scan = _run_server_audit_for_task(task.payload)
            upload_root = project_root
        else:
            assert target_root is not None
            save_raw = bool(task.payload.get("saveRaw") or task.payload.get("save_raw"))
            scan = run_scan(target_root, save_raw=save_raw)
            upload_root = target_root
        upload_scan_result_to_registered_scan(
            upload_root,
            scan,
            api_url=api_url,
            token=upload_token,
            scan_id=task.scan_id,
            raw_upload_url=raw_upload_url,
        )
    except Exception as exc:  # noqa: BLE001 - return task failure without killing the agent.
        return _failed_task(task, f"SCAN_REQUEST failed: {exc}")

    return AgentTaskResult(
        task_id=task.task_id,
        task_type=task.task_type,
        status="SUCCESS",
        message=f"{scan_type} completed and uploaded for scanId={task.scan_id}.",
        patch_results=[],
        scan_id=task.scan_id,
        scan_type=scan_type,
    )


def _failed_task(task: AgentTask, message: str) -> AgentTaskResult:
    scan_type = None
    if isinstance(task.payload, dict):
        scan_type = _payload_string(task.payload, "scanType", "scan_type")
    return AgentTaskResult(
        task_id=task.task_id,
        task_type=task.task_type,
        status="FAILED",
        message=message,
        patch_results=[],
        scan_id=task.scan_id,
        scan_type=scan_type.upper() if scan_type else None,
    )


def _payload_string(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _payload_bool(payload: dict[str, Any], *keys: str, default: bool = False) -> bool:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.strip():
            return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return default


def _payload_checks(payload: dict[str, Any]) -> list[str] | None:
    value = payload.get("checks") or payload.get("serverChecks") or payload.get("server_checks")
    if isinstance(value, list):
        checks = [str(item).strip() for item in value if str(item).strip()]
        return checks or None
    if isinstance(value, str) and value.strip():
        checks = [item.strip() for item in value.split(",") if item.strip()]
        return checks or None
    return None


def _run_server_audit_for_task(payload: dict[str, Any]) -> dict[str, Any]:
    result = run_server_audit(
        checks=_payload_checks(payload),
        include_os_packages=_payload_bool(payload, "includeOsPackages", "include_os_packages"),
        allow_sudo=_payload_bool(payload, "allowSudo", "allow_sudo"),
    )
    scan = asdict(result)
    scan["scanType"] = "SERVER_AUDIT"
    return scan


def _resolve_scan_root(agent_root: Path, payload: dict[str, Any]) -> Path:
    raw_path = _payload_string(payload, "targetPath", "projectPath", "path") or "."
    requested_path = Path(raw_path)
    candidate = requested_path if requested_path.is_absolute() else agent_root / requested_path
    resolved_agent_root = agent_root.resolve()
    resolved_candidate = candidate.resolve()
    try:
        resolved_candidate.relative_to(resolved_agent_root)
    except ValueError as exc:
        raise ValueError("SCAN_REQUEST target path must stay inside the agent project root.") from exc
    if not resolved_candidate.exists():
        raise ValueError(f"SCAN_REQUEST target path does not exist: {resolved_candidate}")
    if not resolved_candidate.is_dir():
        raise ValueError(f"SCAN_REQUEST target path is not a directory: {resolved_candidate}")
    return resolved_candidate


async def watch_agent(
    *,
    api_url: str,
    agent_id: int,
    project_id: int,
    agent_token: str,
    project_root: Path,
    interval_seconds: float,
    once: bool,
    dry_run: bool,
    upload_token: str | None = None,
    reconnect: bool = True,
    max_retries: int | None = None,
    reconnect_max_delay_seconds: float = 30.0,
    on_event,
) -> None:
    try:
        import websockets
    except ImportError as exc:  # pragma: no cover - depends on optional runtime install state.
        raise RuntimeError("websockets package is required for agent-watch. Reinstall the CLI package.") from exc

    ws_url = build_agent_ws_url(api_url)
    headers = {"Authorization": f"Bearer {agent_token}"}
    attempt = 0
    while True:
        try:
            await _watch_agent_session(
                websockets=websockets,
                ws_url=ws_url,
                headers=headers,
                api_url=api_url,
                agent_id=agent_id,
                project_id=project_id,
                agent_token=agent_token,
                upload_token=upload_token,
                project_root=project_root,
                interval_seconds=interval_seconds,
                once=once,
                dry_run=dry_run,
                on_event=on_event,
            )
            return
        except Exception as exc:
            if _is_agent_auth_error(exc):
                on_event("auth_failed", {"error": str(exc)})
                raise
            if once or not reconnect:
                raise
            attempt += 1
            if max_retries is not None and attempt > max_retries:
                on_event("reconnect_gave_up", {"attempt": attempt - 1, "error": str(exc)})
                raise
            delay = min(reconnect_max_delay_seconds, 2 ** min(attempt - 1, 5))
            on_event("disconnected", {"attempt": attempt, "error": str(exc)})
            on_event("reconnecting", {"attempt": attempt, "delaySeconds": delay})
            await asyncio.sleep(delay)


async def _watch_agent_session(
    *,
    websockets: Any,
    ws_url: str,
    headers: dict[str, str],
    api_url: str,
    agent_id: int,
    project_id: int,
    agent_token: str,
    project_root: Path,
    interval_seconds: float,
    once: bool,
    dry_run: bool,
    upload_token: str | None = None,
    on_event,
) -> None:
    async with _connect_websocket(websockets, ws_url, headers) as websocket:
        await websocket.send(json.dumps(_connect_message(agent_id, project_id)))
        connected = await websocket.recv()
        on_event("connected", connected)

        _process_agent_tasks(
            api_url=api_url,
            agent_id=agent_id,
            agent_token=agent_token,
            upload_token=upload_token,
            project_root=project_root,
            dry_run=dry_run,
            on_event=on_event,
        )
        if once:
            return

        on_event("watching", {"mode": "websocket"})
        heartbeat_interval = max(0.1, interval_seconds)
        last_task_check = _monotonic()
        while True:
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=heartbeat_interval)
            except asyncio.TimeoutError:
                ping = _ping_message(agent_id)
                on_event("ping", ping)
                await websocket.send(json.dumps(ping))
                now = _monotonic()
                if now - last_task_check >= AGENT_FALLBACK_POLL_INTERVAL_SECONDS:
                    _process_agent_tasks(
                        api_url=api_url,
                        agent_id=agent_id,
                        agent_token=agent_token,
                        upload_token=upload_token,
                        project_root=project_root,
                        dry_run=dry_run,
                        on_event=on_event,
                    )
                    last_task_check = now
                continue
            tasks = _tasks_from_ws_message(message)
            if tasks is None:
                on_event("task_available", message)
                _process_agent_tasks(
                    api_url=api_url,
                    agent_id=agent_id,
                    agent_token=agent_token,
                    upload_token=upload_token,
                    project_root=project_root,
                    dry_run=dry_run,
                    on_event=on_event,
                )
                last_task_check = _monotonic()
                continue
            if tasks:
                on_event("tasks_found", tasks)
                _process_agent_tasks(
                    api_url=api_url,
                    agent_id=agent_id,
                    agent_token=agent_token,
                    upload_token=upload_token,
                    project_root=project_root,
                    dry_run=dry_run,
                    on_event=on_event,
                    tasks=tasks,
                )
                last_task_check = _monotonic()


def _process_agent_tasks(
    *,
    api_url: str,
    agent_id: int,
    agent_token: str,
    project_root: Path,
    dry_run: bool,
    on_event,
    upload_token: str | None = None,
    tasks: list[AgentTask] | None = None,
) -> None:
    if tasks is None:
        on_event("checking_tasks", None)
        tasks = fetch_pending_agent_tasks(api_url, agent_id, agent_token)
        on_event("tasks_found", tasks)
    for task in tasks:
        try:
            result = handle_agent_task(
                project_root,
                task,
                dry_run=dry_run,
                api_url=api_url,
                agent_token=agent_token,
                upload_token=upload_token,
            )
        except Exception as exc:  # noqa: BLE001 - keep the long-running agent alive per task.
            result = AgentTaskResult(
                task_id=task.task_id,
                task_type=task.task_type,
                status="FAILED",
                message=f"Task failed: {exc}",
                patch_results=[],
            )
        on_event("task", result)
        if not dry_run:
            try:
                report = report_agent_task_result(api_url, agent_id, agent_token, task, result)
            except Exception as exc:  # noqa: BLE001 - report failure must not stop the agent.
                on_event(
                    "task_result_report_failed",
                    {"taskId": task.task_id, "taskType": task.task_type, "error": str(exc)},
                )
            else:
                if report is not None:
                    on_event(
                        "task_result_reported",
                        {"taskId": task.task_id, "taskType": task.task_type, "count": 1},
                    )


def _tasks_from_ws_message(message: Any) -> list[AgentTask] | None:
    try:
        payload = json.loads(message) if isinstance(message, str) else message
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, dict):
        return []
    message_type = payload.get("type")
    if message_type == "TASK_AVAILABLE":
        return None
    if message_type != "TASK_ASSIGNED":
        return []
    try:
        return [
            AgentTask(
                task_id=int(payload["taskId"]),
                task_type=str(payload["taskType"]),
                task_status=str(payload.get("taskStatus") or "SENT"),
                project_id=int(payload["projectId"]),
                scan_id=int(payload["scanId"]) if payload.get("scanId") is not None else None,
                finding_id=int(payload["findingId"]) if payload.get("findingId") is not None else None,
                payload=payload.get("payload") if isinstance(payload.get("payload"), dict) else None,
            )
        ]
    except (KeyError, TypeError, ValueError):
        return None


def _connect_websocket(websockets: Any, ws_url: str, headers: dict[str, str]) -> Any:
    try:
        return websockets.connect(ws_url, additional_headers=headers)
    except TypeError:
        return websockets.connect(ws_url, extra_headers=headers)


def _is_agent_auth_error(exc: Exception) -> bool:
    if not isinstance(exc, httpx.HTTPStatusError):
        return False
    return exc.response.status_code in {401, 403}


def _connect_message(agent_id: int, project_id: int) -> dict[str, Any]:
    return {
        "type": "CONNECT",
        "agentId": agent_id,
        "projectId": project_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _ping_message(agent_id: int) -> dict[str, Any]:
    return {
        "type": "PING",
        "agentId": agent_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _parse_agent_task(item: dict[str, Any]) -> AgentTask:
    return AgentTask(
        task_id=int(item["taskId"]),
        task_type=str(item["taskType"]),
        task_status=str(item["taskStatus"]),
        project_id=int(item["projectId"]),
        scan_id=int(item["scanId"]) if item.get("scanId") is not None else None,
        finding_id=int(item["findingId"]) if item.get("findingId") is not None else None,
        payload=item.get("payload") if isinstance(item.get("payload"), dict) else None,
    )


def _build_agent_task_result_payload(result: AgentTaskResult) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "taskStatus": "SUCCEEDED" if result.status == "SUCCESS" else "FAILED",
        "resultMessage": result.message,
        "patchResults": [_build_patch_result_item(item) for item in result.patch_results],
    }
    return payload


def _build_patch_result_item(result: PatchApplyResult) -> dict[str, Any]:
    item: dict[str, Any] = {
        "patchId": result.patch_id,
        "filePath": result.file_path,
        "status": "SUCCESS" if result.status == "SUCCESS" else "FAILED",
        "message": result.message,
    }
    if result.backup_path:
        item["backupPath"] = result.backup_path
    return item
