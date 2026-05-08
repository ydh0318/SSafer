from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx

from ssafer.core.patches import PatchApplyResult, PatchError, apply_patch_candidates, extract_patch_candidates


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


def build_agent_ws_url(api_url: str) -> str:
    parsed = urlparse(api_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse((scheme, parsed.netloc, "/ws/v1/internal/agents/connect", "", "", ""))


def fetch_pending_agent_tasks(api_url: str, agent_id: int, agent_token: str) -> list[AgentTask]:
    endpoint = f"{api_url.rstrip('/')}/api/v1/internal/agents/{agent_id}/tasks"
    headers = {"Authorization": f"Bearer {agent_token}"}
    with httpx.Client(timeout=20.0) as client:
        response = client.get(endpoint, headers=headers)
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    if not isinstance(data, list):
        return []
    return [_parse_agent_task(item) for item in data if isinstance(item, dict)]


def handle_agent_task(project_root: Path, task: AgentTask, *, dry_run: bool = False) -> AgentTaskResult:
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
        results = apply_patch_candidates(project_root, candidates, dry_run=dry_run)
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
                project_root=project_root,
                interval_seconds=interval_seconds,
                once=once,
                dry_run=dry_run,
                on_event=on_event,
            )
            return
        except Exception as exc:
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
    on_event,
) -> None:
    async with _connect_websocket(websockets, ws_url, headers) as websocket:
        await websocket.send(json.dumps(_connect_message(agent_id, project_id)))
        connected = await websocket.recv()
        on_event("connected", connected)

        while True:
            on_event("checking_tasks", None)
            tasks = fetch_pending_agent_tasks(api_url, agent_id, agent_token)
            on_event("tasks_found", tasks)
            for task in tasks:
                try:
                    result = handle_agent_task(project_root, task, dry_run=dry_run)
                except Exception as exc:  # noqa: BLE001 - keep the long-running agent alive per task.
                    result = AgentTaskResult(
                        task_id=task.task_id,
                        task_type=task.task_type,
                        status="FAILED",
                        message=f"Task failed: {exc}",
                        patch_results=[],
                    )
                on_event("task", result)

            if once:
                return

            on_event("watching", {"intervalSeconds": interval_seconds})
            await websocket.send(json.dumps(_ping_message(agent_id)))
            pong = await websocket.recv()
            on_event("ping", pong)
            await asyncio.sleep(interval_seconds)


def _connect_websocket(websockets: Any, ws_url: str, headers: dict[str, str]) -> Any:
    try:
        return websockets.connect(ws_url, additional_headers=headers)
    except TypeError:
        return websockets.connect(ws_url, extra_headers=headers)


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
