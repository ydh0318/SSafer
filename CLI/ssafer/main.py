from __future__ import annotations

import asyncio
import os
import re
import sys
import threading
import time
from pathlib import Path
from typing import Optional

import httpx
import typer
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ssafer import __version__
from ssafer.core.doctor import collect_doctor_status, install_trivy_with_winget
from ssafer.core.result_store import load_last_scan, run_scan
from ssafer.core.upload import upload_last_scan, upload_last_server_audit

app = typer.Typer(help="SSAfer security configuration CLI.")
console = Console()

_STATUS_KO = {
    "SUCCESS": "[green]성공[/green]",
    "PARTIAL": "[yellow]부분 성공 (경고 있음)[/yellow]",
    "FAILED": "[red]실패[/red]",
}

_TYPE_KO = {
    "sanitized-effective-compose": "마스킹된 Compose 설정",
    "env-metadata": "환경변수 메타데이터",
    "trivy-json": "Trivy 취약점 결과",
}

# 왼쪽 방향 거위 프레임 (발 교차)
_GOOSE_LEFT = [
    "  _     \n<(.)__  \n (___/  \n ♩  ♩  ",
    "  _     \n<(.)__  \n (___/  \n  ♩♩   ",
]

# 오른쪽 방향 거위 프레임 (발 교차)
_GOOSE_RIGHT = [
    "    _   \n __(.)> \n  \\___) \n  ♩  ♩ ",
    "    _   \n __(.)> \n  \\___) \n   ♩♩  ",
]

_TRACK_W = 36
_GOOSE_W = 8
_REPORT_EVIDENCE_MAX = 80

_REPORT_RULE_DISPLAY = {
    "COMPOSE_EXPOSED_DB_PORT": "COMPOSE_DB_PORT",
    "COMPOSE_HARDCODED_SECRET": "COMPOSE_SECRET",
    "COMPOSE_PRIVILEGED_MODE": "COMPOSE_PRIVILEGED",
    "COMPOSE_HOST_NETWORK": "COMPOSE_HOST_NET",
    "COMPOSE_LATEST_TAG": "COMPOSE_LATEST",
    "COMPOSE_ROOT_USER": "COMPOSE_ROOT",
    "COMPOSE_NO_MEMORY_LIMIT": "COMPOSE_NO_MEM_LIMIT",
    "ENV_PLAIN_SECRET": "ENV_SECRET",
    "DS-0002": "DOCKER_ROOT_USER",
    "DS-0026": "DOCKER_HEALTHCHECK",
}

_TRIVY_TITLE_KO = {
    "DS-0002": "Dockerfile이 root 사용자로 실행됨",
    "DS-0026": "Dockerfile에 HEALTHCHECK가 없음",
}

_TRIVY_EVIDENCE_KO = {
    "DS-0002": "USER root 또는 non-root USER 미지정",
    "DS-0026": "HEALTHCHECK 명령어 미정의",
}


def _walking_panel(pos: int, direction: int, frame: int, step: str) -> Panel:
    src = _GOOSE_RIGHT if direction > 0 else _GOOSE_LEFT
    goose = src[frame % 2]
    pad = " " * pos
    padded = "\n".join(pad + line for line in goose.split("\n"))
    content = Text()
    content.append(padded, style="yellow")
    content.append("\n" + "─" * _TRACK_W, style="dim white")
    content.append(f"\n\n▶  {step}", style="bold green")
    return Panel(
        content,
        title="[bold blue]SSAfer 보안 스캔[/bold blue]",
        border_style="blue",
        width=_TRACK_W + 6,
    )


@app.callback()
def callback() -> None:
    """SSAfer CLI."""


@app.command()
def version() -> None:
    """Print the SSAfer CLI version."""
    console.print(__version__)


@app.command()
def doctor() -> None:
    """Check local tools needed by SSAfer."""
    status = collect_doctor_status()
    table = Table(title="SSAfer 환경 점검")
    table.add_column("항목")
    table.add_column("상태")
    table.add_column("내용")
    for item in status["checks"]:
        label = "[green]정상[/green]" if item["ok"] else "[red]없음[/red]"
        table.add_row(item["name"], label, item["detail"])
    console.print(table)
    if not status["trivyFound"]:
        console.print("[yellow]Trivy 설치:[/yellow] ssafer install-tools")


@app.command("install-tools")
def install_tools() -> None:
    """Install optional local tools used by SSAfer."""
    ok, message = install_trivy_with_winget()
    if ok:
        console.print(f"[green]{message}[/green]")
        return
    console.print(f"[red]{message}[/red]")
    raise typer.Exit(code=1)


@app.command("server-audit")
def server_audit(
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="Output root for .ssafer server-audit files."),
    upload: bool = typer.Option(False, "--upload", help="Upload the generated server audit package."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="Backend API base URL for --upload."),
    checks: Optional[str] = typer.Option(
        None,
        "--checks",
        help="Comma-separated checks: ports,processes,docker,ssh,firewall,nginx,os-packages.",
    ),
    details: bool = typer.Option(False, "--details", "-d", help="Print findings, warnings, and artifacts."),
    include_os_packages: bool = typer.Option(
        False,
        "--include-os-packages",
        help="Run Trivy rootfs OS package vulnerability scan. This can be slow and may require privileges.",
    ),
    allow_sudo_option: bool = typer.Option(
        False,
        "--allow-sudo",
        help="Retry privileged server checks with sudo without asking for confirmation.",
    ),
) -> None:
    """Audit runtime security state from inside a server."""
    from ssafer.server.audit import run_server_audit, save_server_audit_result

    selected_checks = [item.strip() for item in checks.split(",") if item.strip()] if checks else None
    needs_sudo_prompt = include_os_packages or selected_checks is None or "firewall" in selected_checks
    allow_sudo = allow_sudo_option
    if needs_sudo_prompt and not allow_sudo:
        if not _can_prompt_for_sudo():
            console.print(
                "[yellow]Some server checks may require sudo. Non-interactive session detected; "
                "continuing without sudo. Use --allow-sudo to retry privileged checks.[/yellow]"
            )
        else:
            allow_sudo = typer.confirm(
                "일부 서버 점검은 sudo 권한이 필요할 수 있습니다. 필요한 명령에만 sudo를 사용하시겠습니까?",
                default=False,
            )
    result = run_server_audit(checks=selected_checks, include_os_packages=include_os_packages, allow_sudo=allow_sudo)
    output_root = path.resolve() if path is not None else Path.home()
    output_path = save_server_audit_result(output_root, result)

    table = Table(title="서버 점검 결과")
    table.add_column("항목")
    table.add_column("수량", justify="right")
    table.add_row("Findings", str(len(result.findings)))
    table.add_row("Warnings", str(len(result.warnings)))
    table.add_row("Artifacts", str(len(result.artifacts)))
    console.print(table)
    if result.warnings:
        console.print("[yellow]경고 목록[/yellow]")
        for warning in result.warnings:
            console.print(f"  - {warning}")
    if details:
        _print_server_audit_details(result)
    if upload:
        response = _upload_server_audit_or_exit(output_root, api_url=api_url)
        _print_upload_response(response)
    console.print(f"[green]서버 점검 결과 저장:[/green] {output_path}")


def _can_prompt_for_sudo() -> bool:
    return bool(getattr(sys.stdin, "isatty", lambda: False)())


@app.command()
def run(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project root to scan."),
    upload: bool = typer.Option(False, "--upload", help="Upload the generated scan package after run."),
    save_raw: bool = typer.Option(False, "--save-raw", help="Store raw effective compose configs locally."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="Backend API base URL for --upload."),
) -> None:
    """Create a local sanitized SSAfer scan package."""
    step_ref = ["스캔 준비 중..."]
    result_ref: list = [None]
    error_ref: list = [None]

    def on_step(msg: str) -> None:
        step_ref[0] = msg

    def do_scan() -> None:
        try:
            result_ref[0] = run_scan(path.resolve(), save_raw=save_raw, on_step=on_step)
        except Exception as exc:  # noqa: BLE001
            error_ref[0] = exc

    thread = threading.Thread(target=do_scan, daemon=True)
    thread.start()

    pos, direction, frame = 0, 1, 0
    with Live(console=console, refresh_per_second=10) as live:
        while thread.is_alive():
            live.update(_walking_panel(pos, direction, frame, step_ref[0]))
            frame = (frame + 1) % 2
            pos += direction * 2
            if pos >= _TRACK_W - _GOOSE_W:
                direction = -1
                pos = _TRACK_W - _GOOSE_W
            elif pos <= 0:
                direction = 1
                pos = 0
            time.sleep(0.12)

    thread.join()

    if error_ref[0]:
        console.print(f"[red]스캔 중 오류 발생:[/red] {error_ref[0]}")
        raise typer.Exit(code=1)

    _print_scan_summary(result_ref[0])
    if upload:
        response = _upload_or_exit(path.resolve(), api_url=api_url)
        _print_upload_response(response)


@app.command()
def upload(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project root containing .ssafer results."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="Backend API base URL."),
) -> None:
    """Upload the last local scan package."""
    response = _upload_or_exit(path.resolve(), api_url=api_url)
    _print_upload_response(response)


@app.command("apply")
def apply_fix(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project root to patch."),
    analysis_result: Optional[Path] = typer.Option(None, "--analysis-result", help="Worker analysis_result.json with patch payloads."),
    patch_id: Optional[str] = typer.Option(None, "--patch-id", help="Apply only one patch ID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Validate patch payloads without modifying files."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Apply without confirmation prompt."),
) -> None:
    """Apply approved patch payloads to local project files."""
    from ssafer.core.patches import (
        PatchCandidate,
        PatchError,
        apply_patch_candidates,
        find_default_analysis_result,
        load_patch_candidates_from_file,
    )

    try:
        project_root = path.resolve()
        analysis_path = analysis_result or find_default_analysis_result(project_root)
        if analysis_path is None:
            raise PatchError(
                "analysis_result.json not found. Use --analysis-result or place it under .ssafer/analysis_result.json."
            )
        console.print(f"[dim]Analysis result: {analysis_path}[/dim]")

        candidates = load_patch_candidates_from_file(analysis_path)
        selected = [candidate for candidate in candidates if patch_id is None or candidate.patch_id == patch_id]
        if not selected:
            console.print("[yellow]No applicable patch payloads found.[/yellow]")
            raise typer.Exit(code=1)

        selected = _select_patch_candidates(selected, patch_id=patch_id, yes=yes)

        if not dry_run and not yes:
            confirmed = typer.confirm("Apply selected patches?")
            if not confirmed:
                console.print("[yellow]Patch apply canceled.[/yellow]")
                raise typer.Exit(code=1)

        selected_patch_id = selected[0].patch_id if len(selected) == 1 else None
        selected_candidates = selected if selected_patch_id is None else candidates
        results = apply_patch_candidates(
            project_root,
            selected_candidates,
            patch_id=selected_patch_id,
            dry_run=dry_run,
        )
    except (OSError, ValueError, PatchError, RuntimeError) as exc:
        console.print(f"[red]Patch apply failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc

    result_table = Table(title="Patch apply result")
    result_table.add_column("Patch ID")
    result_table.add_column("Status")
    result_table.add_column("File", overflow="fold")
    result_table.add_column("Message", overflow="fold")
    result_table.add_column("Backup", overflow="fold")
    for result in results:
        result_table.add_row(
            result.patch_id,
            result.status,
            result.file_path,
            result.message,
            result.backup_path or "-",
        )
    console.print(result_table)


@app.command("agent-watch")
def agent_watch(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project root where patches are applied."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="Backend API base URL."),
    agent_id: Optional[int] = typer.Option(None, "--agent-id", help="Local agent ID issued by the backend."),
    project_id: Optional[int] = typer.Option(None, "--project-id", help="Project ID bound to the local agent."),
    agent_token: Optional[str] = typer.Option(None, "--agent-token", help="Agent bearer token issued by the backend."),
    interval: float = typer.Option(5.0, "--interval", help="Polling interval in seconds."),
    once: bool = typer.Option(False, "--once", help="Connect, fetch pending tasks once, then exit."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Validate patch tasks without modifying files."),
) -> None:
    """Connect a local agent and apply pending PATCH_APPLY tasks."""
    from ssafer.core.agent import AgentTaskResult, watch_agent
    from ssafer.core.auth import load_endpoint

    effective_url = api_url or load_endpoint()
    effective_agent_id = agent_id or _load_int_env("SSAFER_AGENT_ID", "agent ID")
    effective_project_id = project_id or _load_int_env("SSAFER_PROJECT_ID", "project ID")
    effective_agent_token = agent_token or os.getenv("SSAFER_AGENT_TOKEN")
    if not effective_agent_token:
        console.print("[red]Agent token is required. Use --agent-token or SSAFER_AGENT_TOKEN.[/red]")
        raise typer.Exit(code=1)
    project_root = path.resolve()

    def on_event(event_type: str, payload: object) -> None:
        if event_type == "connected":
            console.print(f"[green]Agent connected.[/green] {payload}")
            return
        if event_type == "ping":
            console.print(f"[dim]Agent heartbeat acknowledged.[/dim] {payload}")
            return
        if isinstance(payload, AgentTaskResult):
            console.print(
                f"[cyan]Task {payload.task_id}[/cyan] {payload.task_type}: "
                f"{payload.status} - {payload.message}"
            )
            for patch_result in payload.patch_results:
                console.print(
                    f"  - {patch_result.patch_id} {patch_result.status} "
                    f"{patch_result.file_path}: {patch_result.message}"
                )

    try:
        asyncio.run(
            watch_agent(
                api_url=effective_url,
                agent_id=effective_agent_id,
                project_id=effective_project_id,
                agent_token=effective_agent_token,
                project_root=project_root,
                interval_seconds=interval,
                once=once,
                dry_run=dry_run,
                on_event=on_event,
            )
        )
    except KeyboardInterrupt:
        console.print("[yellow]Agent watch stopped.[/yellow]")
    except Exception as exc:  # noqa: BLE001
        console.print(f"[red]Agent watch failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc


def _load_int_env(name: str, label: str) -> int:
    value = os.getenv(name)
    if not value:
        console.print(f"[red]Agent {label} is required. Use --{name.lower().removeprefix('ssafer_').replace('_', '-')} or {name}.[/red]")
        raise typer.Exit(code=1)
    try:
        return int(value)
    except ValueError as exc:
        console.print(f"[red]{name} must be an integer.[/red]")
        raise typer.Exit(code=1) from exc


def _select_patch_candidates(
    candidates: list["PatchCandidate"],
    *,
    patch_id: str | None,
    yes: bool,
) -> list["PatchCandidate"]:
    table = Table(title="Applicable patch candidates")
    table.add_column("No.", justify="right")
    table.add_column("Patch ID")
    table.add_column("Finding ID")
    table.add_column("File", overflow="fold")
    table.add_column("Operation")
    for index, candidate in enumerate(candidates, start=1):
        table.add_row(
            str(index),
            candidate.patch_id,
            candidate.finding_id or "-",
            candidate.file_path,
            candidate.operation,
        )
    if len(candidates) > 1 and patch_id is None:
        table.add_row(str(len(candidates) + 1), "ALL", "-", "Apply all patch candidates", "-")
    console.print(table)

    if patch_id is not None or yes or len(candidates) == 1:
        return candidates

    choice = typer.prompt("Select patch number")
    try:
        selected = int(choice)
    except ValueError as exc:
        raise PatchError("Patch selection must be a number.") from exc

    if selected == len(candidates) + 1:
        return candidates
    if selected < 1 or selected > len(candidates):
        raise PatchError(f"Patch selection is out of range: {selected}")
    return [candidates[selected - 1]]


@app.command()
def login(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer 서버 API URL"),
    logout: bool = typer.Option(False, "--logout", help="저장된 토큰 삭제"),
) -> None:
    """SSAfer 서버에 로그인합니다."""
    from ssafer.core.auth import clear_token, load_endpoint, login_with_credentials, save_auth_tokens

    if logout:
        clear_token()
        console.print("[green]로그아웃 완료. 저장된 토큰이 삭제되었습니다.[/green]")
        return

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("Email")
    password = typer.prompt("Password", hide_input=True)
    if not email.strip() or not password.strip():
        console.print("[red]Email and password are required.[/red]")
        raise typer.Exit(code=1)
    try:
        auth_data = login_with_credentials(effective_endpoint, email.strip(), password)
        save_auth_tokens(auth_data, effective_endpoint)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Login failed:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]Login failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    except ValueError as exc:
        console.print(f"[red]Login failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Login succeeded. Tokens saved to ~/.ssafer/config.yml.[/green]")


@app.command()
def signup(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer backend API URL"),
) -> None:
    """Verify email and create a SSAfer backend user account."""
    from ssafer.core.auth import (
        load_endpoint,
        register_user,
        send_email_verification_code,
        verify_email_code,
    )

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("Email")
    display_name = typer.prompt("Display name")
    password = typer.prompt("Password", hide_input=True)
    if not email.strip() or not display_name.strip() or not password.strip():
        console.print("[red]Email, display name, and password are required.[/red]")
        raise typer.Exit(code=1)
    try:
        send_email_verification_code(effective_endpoint, email.strip())
        console.print("[green]Verification code sent. Check your email.[/green]")
        code = typer.prompt("Verification code")
        if not code.strip():
            console.print("[red]Verification code is required.[/red]")
            raise typer.Exit(code=1)
        verify_email_code(effective_endpoint, email.strip(), code.strip())
        register_user(effective_endpoint, email.strip(), display_name.strip(), password)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Signup failed:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]Signup failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Signup succeeded. Run 'ssafer login' to save login tokens.[/green]")


@app.command("send-email-code")
def send_email_code(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer backend API URL"),
) -> None:
    """Send an email verification code for SSAfer signup."""
    from ssafer.core.auth import load_endpoint, send_email_verification_code

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("Email")
    if not email.strip():
        console.print("[red]Email is required.[/red]")
        raise typer.Exit(code=1)
    try:
        send_email_verification_code(effective_endpoint, email.strip())
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Email code request failed:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]Email code request failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Verification code sent. Check your email.[/green]")


@app.command("verify-email")
def verify_email(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer backend API URL"),
) -> None:
    """Verify the email code before SSAfer signup."""
    from ssafer.core.auth import load_endpoint, verify_email_code

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("Email")
    code = typer.prompt("Verification code")
    if not email.strip() or not code.strip():
        console.print("[red]Email and verification code are required.[/red]")
        raise typer.Exit(code=1)
    try:
        verify_email_code(effective_endpoint, email.strip(), code.strip())
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Email verification failed:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]Email verification failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Email verified. Run 'ssafer signup' to create your account.[/green]")


@app.command()
def logout() -> None:
    """Clear the saved SSAfer upload token."""
    from ssafer.core.auth import clear_token

    clear_token()
    console.print("[green]Saved SSAfer token cleared.[/green]")


@app.command()
def report(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project root containing .ssafer results."),
    details: bool = typer.Option(False, "--details", "-d", help="Print targets, artifacts, and output paths."),
) -> None:
    """Print the last local scan summary."""
    project_root = path.resolve()
    scan = load_last_scan(project_root)
    if scan is None:
        console.print("[yellow]스캔 결과가 없습니다. 먼저 ssafer run 을 실행해주세요.[/yellow]")
        raise typer.Exit(code=1)
    _print_scan_summary(scan)
    if details:
        _print_scan_details(scan, project_root)


def _format_http_error(exc: httpx.HTTPStatusError) -> str:
    status_code = exc.response.status_code
    try:
        payload = exc.response.json()
    except ValueError:
        return f"backend returned {status_code}."
    code = payload.get("code")
    message = payload.get("message")
    if code and message:
        return f"backend returned {status_code} ({code}: {message})."
    if message:
        return f"backend returned {status_code} ({message})."
    return f"backend returned {status_code}."


def _format_upload_request_url(url: object) -> str:
    text = str(url)
    if "/api/" in text:
        return text
    return "S3 presigned upload URL hidden"


def _print_scan_summary(scan: dict) -> None:
    summary = scan.get("cliSummary", {})
    status = scan.get("analysisStatus", "UNKNOWN")
    status_label = _STATUS_KO.get(status, status)

    table = Table(title=f"스캔 결과  {status_label}")
    table.add_column("항목")
    table.add_column("수량", justify="right")
    rows = [
        ("Compose 세트", "composeSets"),
        ("환경변수 파일 (.env)", "envFiles"),
        ("Dockerfile", "dockerfiles"),
        ("커스텀 룰 발견", "customRuleFindings"),
        ("Trivy 발견", "trivyFindings"),
        ("전체 발견 수", "totalFindings"),
        ("경고", "warnings"),
    ]
    for label, key in rows:
        table.add_row(label, str(summary.get(key, 0)))
    console.print(table)

    warnings = scan.get("warnings", [])
    if warnings:
        console.print("[yellow]경고 목록[/yellow]")
        for warning in warnings:
            console.print(f"  - {_format_scan_warning(warning)}")


def _print_scan_details(scan: dict, project_root: Path) -> None:
    results_dir = project_root / ".ssafer" / "results"
    last_scan_path = results_dir / f"{scan.get('scanId', 'unknown')}.json"
    marker_path = results_dir / "last_scan.txt"
    sanitized_dir = project_root / ".ssafer" / "effective" / "sanitized"
    trivy_dir = project_root / ".ssafer" / "trivy"

    status = scan.get("analysisStatus", "UNKNOWN")
    status_text = {"SUCCESS": "성공", "PARTIAL": "부분 성공 (경고 있음)", "FAILED": "실패"}.get(status, status)
    trivy = scan.get("toolVersions", {}).get("trivy") or "설치되지 않음"
    docker_compose = scan.get("toolVersions", {}).get("dockerCompose") or "찾을 수 없음"

    console.print()
    console.print(
        Panel.fit(
            "\n".join([
                f"스캔 ID        : {scan.get('scanId', 'unknown')}",
                f"상태           : {status_text}",
                f"SSAfer 버전    : {scan.get('toolVersion', 'unknown')}",
                f"Trivy 버전     : {trivy}",
                f"Docker Compose : {docker_compose}",
            ]),
            title="스캔 정보",
        )
    )

    output_table = Table(title="생성된 파일 위치")
    output_table.add_column("파일 종류")
    output_table.add_column("경로", overflow="fold")
    output_table.add_row("스캔 결과 패키지 (JSON)", str(last_scan_path))
    output_table.add_row("최근 스캔 마커", str(marker_path))
    output_table.add_row("마스킹된 Compose 파일 폴더", str(sanitized_dir))
    output_table.add_row("Trivy 결과 폴더", str(trivy_dir))
    console.print(output_table)

    _print_targets(scan)
    _print_findings(scan)
    _print_artifacts(scan)


def _print_targets(scan: dict) -> None:
    targets = scan.get("targets", {})

    target_table = Table(title="스캔 대상")
    target_table.add_column("종류")
    target_table.add_column("개수", justify="right")
    target_table.add_column("파일 목록", overflow="fold")
    target_table.add_row(
        "환경변수 파일 (.env)",
        str(len(targets.get("envFiles", []))),
        _join_items(targets.get("envFiles", [])),
    )
    target_table.add_row(
        "Dockerfile",
        str(len(targets.get("dockerfiles", []))),
        _join_items(targets.get("dockerfiles", [])),
    )
    compose_names = [
        f"{item.get('name', 'unknown')} ({', '.join(item.get('files', []))})"
        for item in targets.get("composeSets", [])
    ]
    target_table.add_row("Compose 세트", str(len(compose_names)), _join_items(compose_names))
    console.print(target_table)


def _print_artifacts(scan: dict) -> None:
    artifacts = scan.get("artifacts", [])
    artifact_table = Table(title="수집된 산출물")
    artifact_table.add_column("종류")
    artifact_table.add_column("대상")
    artifact_table.add_column("해시 (앞 12자리)")
    artifact_table.add_column("발견된 취약점 수", justify="right")

    for artifact in artifacts:
        artifact_type = artifact.get("type", "unknown")
        target = artifact.get("target") or artifact.get("composeSet") or "-"
        finding_count = "-"
        if artifact_type == "trivy-json":
            finding_count = str(_count_trivy_artifact_findings(artifact.get("content", {})))
        artifact_table.add_row(
            _TYPE_KO.get(artifact_type, artifact_type),
            target,
            str(artifact.get("hash", ""))[:12],
            finding_count,
        )
    console.print(artifact_table)


def _print_findings(scan: dict) -> None:
    findings = scan.get("findings", [])
    finding_groups = _group_report_findings(findings)
    finding_table = Table(title="Findings", show_lines=True)
    finding_table.add_column("IDs", overflow="fold")
    finding_table.add_column("Count", justify="right")
    finding_table.add_column("Severity")
    finding_table.add_column("Rule")
    finding_table.add_column("Location", overflow="fold")
    finding_table.add_column("Title", overflow="fold")
    finding_table.add_column("Evidence", overflow="fold")

    if not finding_groups:
        finding_table.add_row("-", "-", "-", "-", "-", "-", "-")
        console.print(finding_table)
        return

    for group in finding_groups:
        finding_table.add_row(
            group["ids"],
            str(group["count"]),
            group["severity"],
            group["ruleId"],
            group["location"],
            group["title"],
            group["evidence"],
        )
    console.print(finding_table)


def _group_report_findings(findings: list[dict]) -> list[dict[str, str | int]]:
    groups: dict[tuple[str, str, str, str], dict[str, object]] = {}
    for finding in findings:
        raw_rule_id = str(finding.get("ruleId") or "-")
        rule_id = _format_report_rule_id(raw_rule_id)
        severity = str(finding.get("severity") or "-")
        title = _format_report_title(finding)
        evidence = _format_report_finding_evidence(finding)
        key = (rule_id, severity, title, evidence)
        group = groups.setdefault(
            key,
            {
                "ruleId": rule_id,
                "severity": severity,
                "title": title,
                "evidence": evidence,
                "locations": [],
                "ids": [],
            },
        )
        group["locations"].append(_format_finding_location(finding))
        group["ids"].append(str(finding.get("id") or "-"))

    result: list[dict[str, str | int]] = []
    for group in groups.values():
        locations = _compact_locations(group["locations"])
        ids = group["ids"]
        result.append(
            {
                "count": len(ids),
                "severity": str(group["severity"]),
                "ruleId": str(group["ruleId"]),
                "location": locations,
                "title": str(group["title"]),
                "evidence": str(group["evidence"]),
                "ids": _join_compact(ids, max_items=5),
            }
        )
    return result


def _format_finding_location(finding: dict) -> str:
    file_path = str(finding.get("file") or "-")
    line = finding.get("line")
    return f"{file_path}:{line}" if line else file_path


def _compact_locations(locations: list[str]) -> str:
    unique = list(dict.fromkeys(locations))
    compose_sets = [_extract_compose_set(location) for location in unique]
    if all(compose_sets):
        return f"docker-compose ({', '.join(compose_sets)})"
    return _join_compact(unique, max_items=3)


def _extract_compose_set(location: str) -> str | None:
    prefix = "docker-compose ("
    if location.startswith(prefix) and location.endswith(")"):
        return location[len(prefix):-1]
    return None


def _join_compact(items: list[str], max_items: int) -> str:
    if not items:
        return "-"
    shown = items[:max_items]
    suffix = f" +{len(items) - max_items}" if len(items) > max_items else ""
    return ", ".join(shown) + suffix


def _format_report_evidence(value: object) -> str:
    if value is None:
        return "-"
    text = str(value).replace("\r", " ").replace("\n", " ").strip()
    if not text:
        return "-"
    if len(text) <= _REPORT_EVIDENCE_MAX:
        return text
    return text[: _REPORT_EVIDENCE_MAX - 3] + "..."


def _format_report_rule_id(rule_id: str) -> str:
    return _REPORT_RULE_DISPLAY.get(rule_id, rule_id)


def _format_report_title(finding: dict) -> str:
    rule_id = str(finding.get("ruleId") or "")
    source = str(finding.get("source") or "")
    if source == "trivy" and rule_id in _TRIVY_TITLE_KO:
        return _TRIVY_TITLE_KO[rule_id]
    return str(finding.get("title") or "-")


def _format_report_finding_evidence(finding: dict) -> str:
    rule_id = str(finding.get("ruleId") or "")
    source = str(finding.get("source") or "")
    if source == "trivy" and rule_id in _TRIVY_EVIDENCE_KO:
        return _TRIVY_EVIDENCE_KO[rule_id]
    return _format_report_evidence(finding.get("maskedEvidence"))


def _format_scan_warning(warning: object) -> str:
    text = str(warning).replace("\r\n", "\n").strip()
    if not text:
        return "-"

    standalone_compose_match = re.search(r"(.+?)을 함께 쓸 기본 Compose 파일 없이 단독으로 분석했습니다\.", text)
    if standalone_compose_match:
        compose_path = Path(standalone_compose_match.group(1))
        return f"기본 Compose 없이 단독 분석: {compose_path.name}"

    missing_vars = list(dict.fromkeys(re.findall(r'The \\?"([^"\\]+)\\?" variable is not set', text)))
    if missing_vars:
        return f"Docker Compose 환경변수 미설정: {_join_compact(missing_vars, max_items=8)}"

    env_file_match = re.search(r"env file (.+?) not found", text)
    if env_file_match:
        return f"Compose env 파일을 찾을 수 없음: {env_file_match.group(1)}"

    service_match = re.search(r'service "([^"]+)" has neither an image nor a build context specified', text)
    if service_match:
        return f"Compose 서비스 '{service_match.group(1)}'에 image/build 설정이 없어 분석하지 못함"

    return _format_report_evidence(text)


def _count_trivy_artifact_findings(content: dict) -> int:
    total = 0
    for result in content.get("Results", []):
        total += len(result.get("Misconfigurations", []) or [])
        total += len(result.get("Vulnerabilities", []) or [])
        total += len(result.get("Secrets", []) or [])
    return total


def _join_items(items: list[str]) -> str:
    if not items:
        return "-"
    return "\n".join(items)


def _print_upload_response(response: dict) -> None:
    console.print("[green]업로드 완료[/green]")
    console.print(f"스캔 ID: {response.get('scanId', 'unknown')}")
    if response.get("viewUrl"):
        console.print(f"결과 보기: {response['viewUrl']}")


def _print_server_audit_details(result: object) -> None:
    findings = getattr(result, "findings", [])
    warnings = getattr(result, "warnings", [])
    artifacts = getattr(result, "artifacts", [])

    finding_table = Table(title="서버 점검 Findings", show_lines=True)
    finding_table.add_column("ID")
    finding_table.add_column("Severity")
    finding_table.add_column("Rule")
    finding_table.add_column("Target", overflow="fold")
    finding_table.add_column("Title", overflow="fold")
    finding_table.add_column("Evidence", overflow="fold")
    if not findings:
        finding_table.add_row("-", "-", "-", "-", "-", "-")
    for finding in findings:
        finding_table.add_row(
            getattr(finding, "id", "-"),
            getattr(finding, "severity", "-"),
            _format_server_rule_id(getattr(finding, "ruleId", "-")),
            getattr(finding, "target", "-"),
            getattr(finding, "title", "-"),
            getattr(finding, "evidence", "-"),
        )
    console.print(finding_table)

    warning_table = Table(title="서버 점검 경고", show_lines=True)
    warning_table.add_column("번호", justify="right")
    warning_table.add_column("메시지", overflow="fold")
    if not warnings:
        warning_table.add_row("-", "-")
    for index, warning in enumerate(warnings, start=1):
        warning_table.add_row(str(index), str(warning))
    console.print(warning_table)

    artifact_table = Table(title="서버 점검 산출물", show_lines=True)
    artifact_table.add_column("Type")
    artifact_table.add_column("Target", overflow="fold")
    artifact_table.add_column("Summary", overflow="fold")
    if not artifacts:
        artifact_table.add_row("-", "-", "-")
    for artifact in artifacts:
        artifact_table.add_row(
            getattr(artifact, "type", "-"),
            getattr(artifact, "target", "-"),
            _summarize_server_artifact(getattr(artifact, "content", None), artifact_type=getattr(artifact, "type", None)),
        )
    console.print(artifact_table)


def _summarize_server_artifact(content: object, *, artifact_type: object = None) -> str:
    if artifact_type == "trivy-rootfs-json" and isinstance(content, dict):
        return _summarize_trivy_rootfs_content(content)
    if isinstance(content, list):
        return f"{len(content)} items"
    if isinstance(content, dict):
        if {"command", "exit_code"}.issubset(content):
            command = " ".join(content.get("command") or [])
            return f"{command} (exit {content.get('exit_code')})"
        return f"{len(content)} keys"
    if content is None:
        return "-"
    text = str(content).replace("\r", " ").replace("\n", " ").strip()
    if not text:
        return "-"
    if len(text) <= _REPORT_EVIDENCE_MAX:
        return text
    return text[: _REPORT_EVIDENCE_MAX - 3] + "..."


def _summarize_trivy_rootfs_content(content: dict) -> str:
    counts: dict[str, int] = {}
    for scan_result in content.get("Results", []) or []:
        for vulnerability in scan_result.get("Vulnerabilities", []) or []:
            severity = str(vulnerability.get("Severity") or "UNKNOWN").upper()
            counts[severity] = counts.get(severity, 0) + 1
    total = sum(counts.values())
    if total == 0:
        return "0 vulnerabilities"
    order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]
    parts = [f"{severity}={counts[severity]}" for severity in order if counts.get(severity, 0) > 0]
    extra = sorted(severity for severity in counts if severity not in order)
    parts.extend(f"{severity}={counts[severity]}" for severity in extra)
    return f"{total} vulnerabilities ({', '.join(parts)})"


def _format_server_rule_id(rule_id: object) -> str:
    text = str(rule_id)
    prefix = "SERVER_"
    if text.startswith(prefix):
        text = text[len(prefix):]
    known = {
        "PUBLIC_SENSITIVE_PORT": "PUBLIC_PORT",
        "SSH_ROOT_LOGIN": "SSH_ROOT_LOGIN",
        "SSH_PASSWORD_AUTH": "SSH_PASSWORD_AUTH",
        "FIREWALL_INACTIVE": "FIREWALL_INACTIVE",
        "OS_PACKAGE_VULNERABILITY": "OS_VULN",
    }
    return known.get(text, text)


def _upload_or_exit(path: Path, api_url: str | None) -> dict:
    from ssafer.core.auth import load_endpoint, load_token
    from ssafer.core.config import load_project_config

    config_warnings: list[str] = []
    project_config = load_project_config(path, config_warnings)
    for warning in config_warnings:
        console.print(f"[yellow]{warning}[/yellow]")

    token = load_token(project_config.upload.token_env)
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    if token is None:
        console.print(
            "[yellow]인증 토큰이 없습니다. 먼저 [bold]ssafer login[/bold]을 실행하거나\n"
            "  환경변수 SSAFER_TOKEN을 설정하세요.[/yellow]"
        )
        raise typer.Exit(code=1)
    try:
        return upload_last_scan(path, api_url=effective_url, token=token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Upload failed:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]Upload failed:[/red] {exc}")
    except RuntimeError as exc:
        console.print(f"[red]Upload failed:[/red] {exc}")
    raise typer.Exit(code=1)


def _upload_server_audit_or_exit(path: Path, api_url: str | None) -> dict:
    from ssafer.core.auth import load_endpoint, load_token
    from ssafer.core.config import load_project_config

    config_warnings: list[str] = []
    project_config = load_project_config(path, config_warnings)
    for warning in config_warnings:
        console.print(f"[yellow]{warning}[/yellow]")

    token = load_token(project_config.upload.token_env)
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    if token is None:
        console.print(
            "[yellow]?氇勳瑔 ?膦応矙???雴侂捒?雿堧枎. 鐧掛嚤? [bold]ssafer login[/bold]???銋诫痪?靹嶊祬??n"
            "  ?靹嶊紞韫偮€??SSAFER_TOKEN???銋检牂?靹応江??[/yellow]"
        )
        raise typer.Exit(code=1)
    try:
        return upload_last_server_audit(path, api_url=effective_url, token=token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]Upload failed:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]Upload failed:[/red] {exc}")
    except RuntimeError as exc:
        console.print(f"[red]Upload failed:[/red] {exc}")
    raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
