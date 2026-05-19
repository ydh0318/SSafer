from __future__ import annotations

import asyncio
import difflib
import os
import re
import sys
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlencode

import httpx
import typer
from rich.console import Console
from rich.live import Live
from rich.markup import escape
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ssafer import __version__
from ssafer.core.doctor import collect_doctor_status, install_trivy_with_winget
from ssafer.core.result_store import load_last_scan, run_scan
from ssafer.core.upload import upload_last_scan, upload_last_server_audit

app = typer.Typer(
    help="프로젝트와 서버 보안 점검을 터미널에서 실행하고 웹 대시보드와 연결합니다.",
    add_completion=False,
    options_metavar="[옵션]",
    subcommand_metavar="명령어",
)
console = Console()

_STATUS_KO = {
    "SUCCESS": "[green]성공[/green]",
    "PARTIAL": "[yellow]부분 성공 (경고 있음)[/yellow]",
    "FAILED": "[red]실패[/red]",
}

_SCAN_EMPTY_STATUS = "[yellow]스캔 대상 없음[/yellow]"

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


@app.command(help="현재 설치된 SSAfer CLI 버전을 확인합니다.", rich_help_panel="기본")
def version() -> None:
    """CLI 버전을 출력합니다."""
    console.print(__version__)


@app.command(help="로그인, 백엔드 endpoint, Local Agent 설정 상태를 확인합니다.", rich_help_panel="계정/상태")
def status() -> None:
    """로그인과 Local Agent 설정 상태를 확인합니다."""
    from ssafer.core.auth import (
        CONFIG_PATH,
        describe_token_source,
        find_agent_config_path,
        get_project_agent_status,
        load_auth_mode,
        load_agent_config,
        load_endpoint,
        load_token,
    )

    token = load_token()
    token_source = describe_token_source()
    auth_mode = load_auth_mode()
    endpoint = load_endpoint()
    agent_config = load_agent_config(Path("."))
    agent_config_path = find_agent_config_path(Path("."))
    backend_agent_status = None
    backend_agent_error = None
    if token and _has_saved_agent_config(agent_config):
        try:
            backend_agent_status = get_project_agent_status(endpoint, int(agent_config.get("projectId")), token)
        except httpx.HTTPStatusError as exc:
            backend_agent_error = _format_http_error(exc)
        except httpx.HTTPError as exc:
            backend_agent_error = _format_http_transport_error(exc)
        except (TypeError, ValueError) as exc:
            backend_agent_error = str(exc)

    if not token:
        auth_status = "[red]로그인 안 됨[/red]"
        auth_detail = "ssafer login 또는 ssafer guest로 먼저 로그인하세요."
    elif auth_mode == "member":
        auth_status = "[green]회원 로그인[/green]"
        auth_detail = f"토큰 출처: {token_source}. CLI 업로드와 Local Agent 연결에 사용됩니다."
    elif auth_mode == "guest":
        auth_status = "[green]게스트 로그인[/green]"
        auth_detail = f"토큰 출처: {token_source}. 같은 게스트 세션에서 만든 프로젝트/스캔에 사용됩니다."
    else:
        auth_status = "[yellow]로그인됨[/yellow]"
        auth_detail = f"토큰 출처: {token_source}. 기존 토큰에는 계정 방식 정보가 없습니다. 다시 로그인하면 회원/게스트가 표시됩니다."

    table = Table(title="SSAfer 상태")
    table.add_column("항목")
    table.add_column("상태")
    table.add_column("설명", overflow="fold")
    table.add_row("인증 상태", auth_status, auth_detail)
    table.add_row("Endpoint", endpoint, "현재 사용할 백엔드 API")
    if _has_saved_agent_config(agent_config):
        project_id = agent_config.get("projectId")
        detail = (
            f"agentId={agent_config.get('agentId')}, projectId={project_id}\n"
            f"설정 파일: {agent_config_path}\n"
            f"웹 프로젝트: {_web_project_url(endpoint, project_id)}"
        )
        status_label = "[green]설정됨[/green]"
        if backend_agent_status:
            status_value = str(backend_agent_status.get("status") or "UNKNOWN")
            status_label = "[green]ONLINE[/green]" if status_value == "ONLINE" else f"[yellow]{status_value}[/yellow]"
            detail_lines = [detail, f"백엔드 상태: {status_value}"]
            if status_value == "ONLINE":
                detail_lines.append("현재 이 프로젝트의 웹 스캔/수정 요청을 받을 수 있습니다.")
            else:
                detail_lines.append("조치: agent 터미널이 켜져 있는지 확인하고, 필요하면 프로젝트 루트에서 ssafer agent를 다시 실행하세요.")
            if backend_agent_status.get("lastSeenAt"):
                detail_lines.append(f"마지막 확인: {backend_agent_status.get('lastSeenAt')}")
            if backend_agent_status.get("currentTaskType"):
                detail_lines.append(f"진행 중인 작업: {backend_agent_status.get('currentTaskType')}")
            detail = "\n".join(detail_lines)
        elif backend_agent_error:
            status_label = "[yellow]확인 실패[/yellow]"
            detail = f"{detail}\n백엔드 상태 확인 실패: {backend_agent_error}\n조치: 네트워크 또는 로그인 토큰을 확인하세요."
        table.add_row("Local Agent", status_label, detail)
    else:
        table.add_row("Local Agent", "[yellow]연결 전[/yellow]", "웹에서 스캔/수정 요청을 보내려면 프로젝트 루트에서 ssafer agent를 실행하세요.")
    table.add_row("Config", str(CONFIG_PATH), "토큰 값은 출력하지 않음")
    console.print(table)


@app.command(hidden=True)
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


@app.command("install-tools", hidden=True)
def install_tools() -> None:
    """Trivy 등 SSAfer가 선택적으로 사용하는 도구를 설치합니다."""
    console.print("[cyan]Trivy를 설치합니다. 몇 분 정도 걸릴 수 있습니다...[/cyan]")
    with console.status("[cyan]설치 진행 중...[/cyan]", spinner="dots"):
        ok, message = install_trivy_with_winget()
    if ok:
        console.print(f"[green]{message}[/green]")
        return
    console.print(f"[red]{message}[/red]")
    raise typer.Exit(code=1)


@app.command("server-audit", hidden=True)
def server_audit(
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="server-audit 결과를 저장할 기준 폴더입니다. 생략하면 홈 디렉터리를 사용합니다."),
    upload: bool = typer.Option(False, "--upload", help="점검 결과를 생성한 뒤 백엔드/S3에 업로드합니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="업로드에 사용할 SSAfer 백엔드 API URL입니다."),
    checks: Optional[str] = typer.Option(
        None,
        "--checks",
        help="실행할 점검 목록입니다. 예: ports,processes,docker,ssh,firewall,nginx,os-packages",
    ),
    details: bool = typer.Option(False, "--details", "-d", help="findings, warnings, artifacts 상세 내용을 함께 출력합니다."),
    include_os_packages: bool = typer.Option(
        False,
        "--include-os-packages",
        help="Trivy rootfs 기반 OS 패키지 취약점 점검을 포함합니다. 오래 걸릴 수 있고 권한이 필요할 수 있습니다.",
    ),
    allow_sudo_option: bool = typer.Option(
        False,
        "--allow-sudo",
        help="권한이 필요한 서버 점검을 사용자 확인 없이 sudo로 재시도합니다.",
    ),
) -> None:
    """EC2/서버 안에서 런타임 보안 상태를 점검합니다."""
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
    if include_os_packages:
        console.print("[cyan]Running server audit. OS package scan can take several minutes...[/cyan]")
    else:
        console.print("[cyan]Running server audit...[/cyan]")
    with console.status("[cyan]Collecting server runtime data...[/cyan]", spinner="dots"):
        result = run_server_audit(checks=selected_checks, include_os_packages=include_os_packages, allow_sudo=allow_sudo)
    output_root = path.resolve() if path is not None else Path.home()
    output_root, output_path = _save_server_audit_result_with_fallback(
        output_root,
        result,
        save_server_audit_result,
    )

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
        console.print("[cyan]서버 점검 결과를 업로드합니다...[/cyan]")
        with console.status("[cyan]업로드 준비 중...[/cyan]", spinner="dots") as status:
            response = _upload_server_audit_or_exit(
                output_root,
                api_url=api_url,
                on_step=lambda message: status.update(f"[cyan]{message}[/cyan]"),
            )
        response = _wait_for_uploaded_scan(output_root, response=response, api_url=api_url)
        _print_upload_response(response)
    console.print(f"[green]서버 점검 결과 저장:[/green] {output_path}")


def _save_server_audit_result_with_fallback(
    output_root: Path,
    result: object,
    save_result: Callable[[Path, object], Path],
) -> tuple[Path, Path]:
    try:
        return output_root, save_result(output_root, result)
    except PermissionError:
        fallback_root = Path.home().resolve()
        if output_root.resolve() == fallback_root:
            raise
        console.print(
            "[yellow]현재 경로에 server-audit 결과를 저장할 권한이 없어 "
            f"홈 디렉터리에 저장합니다: {fallback_root}[/yellow]"
        )
        return fallback_root, save_result(fallback_root, result)


def _can_prompt_for_sudo() -> bool:
    return bool(getattr(sys.stdin, "isatty", lambda: False)())


@app.command(help="프로젝트 설정 파일을 스캔하고 결과 JSON을 로컬에 저장합니다.", rich_help_panel="로컬 점검")
def run(
    path: Path = typer.Option(Path("."), "--path", "-p", help="스캔할 프로젝트 루트입니다. CLI 폴더 안이면 보통 --path .. 를 사용합니다."),
    upload: bool = typer.Option(False, "--upload", help="스캔 후 결과 JSON을 백엔드/S3에 바로 업로드합니다."),
    save_raw: bool = typer.Option(False, "--save-raw", help="마스킹 전 effective compose 설정도 로컬에 저장합니다. 민감정보 포함 가능성이 있어 주의하세요."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="--upload에 사용할 SSAfer 백엔드 API URL입니다."),
    env: Optional[str] = typer.Option(None, "--env", "-e", help="환경 (local/production). 생략 시 자동 감지합니다."),
) -> None:
    """현재 프로젝트의 설정 파일을 점검하고 로컬 결과 JSON을 생성합니다."""
    step_ref = ["스캔을 준비하는 중..."]
    result_ref: list = [None]
    error_ref: list = [None]

    def on_step(msg: str) -> None:
        step_ref[0] = msg

    def do_scan() -> None:
        try:
            result_ref[0] = run_scan(path.resolve(), save_raw=save_raw, on_step=on_step, environment=env)
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
        console.print("[cyan]스캔 결과를 업로드합니다...[/cyan]")
        with console.status("[cyan]업로드 준비 중...[/cyan]", spinner="dots") as status:
            response = _upload_or_exit(
                path.resolve(),
                api_url=api_url,
                on_step=lambda message: status.update(f"[cyan]{message}[/cyan]"),
            )
        response = _wait_for_uploaded_scan(path.resolve(), response=response, api_url=api_url)
        _print_upload_response(response)


@app.command(help="최근 로컬 스캔 결과를 업로드합니다. 서버 점검 결과는 ssafer upload --server로 업로드합니다.", rich_help_panel="로컬 점검")
def upload(
    path: Optional[Path] = typer.Option(None, "--path", "-p", help=".ssafer/results가 있는 프로젝트 루트입니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="업로드에 사용할 SSAfer 백엔드 API URL입니다."),
    server: bool = typer.Option(False, "--server", help="최근 server-audit 결과를 새로 점검하지 않고 업로드합니다."),
) -> None:
    """최근 로컬 스캔 결과 또는 서버 점검 결과를 백엔드/S3에 업로드합니다."""
    upload_root = path.resolve() if path is not None else (Path.home().resolve() if server else Path(".").resolve())
    if server:
        console.print("[cyan]최근 서버 점검 결과를 업로드합니다...[/cyan]")
    else:
        console.print("[cyan]스캔 결과를 업로드합니다...[/cyan]")
    with console.status("[cyan]업로드 준비 중...[/cyan]", spinner="dots") as status:
        if server:
            response = _upload_server_audit_or_exit(
                upload_root,
                api_url=api_url,
                on_step=lambda message: status.update(f"[cyan]{message}[/cyan]"),
            )
        else:
            response = _upload_or_exit(
                upload_root,
                api_url=api_url,
                on_step=lambda message: status.update(f"[cyan]{message}[/cyan]"),
            )
    response = _wait_for_uploaded_scan(upload_root, response=response, api_url=api_url)
    _print_upload_response(response)


@app.command("apply", help="AI가 제안한 수정안을 미리 보고 로컬 파일에 적용합니다.", rich_help_panel="수정 적용")
def apply_fix(
    scan_id_arg: Optional[int] = typer.Argument(None, help="적용할 백엔드 scanId입니다. 예: ssafer apply 49"),
    path: Path = typer.Option(Path("."), "--path", "-p", help="수정안을 적용할 프로젝트 루트입니다."),
    analysis_result: Optional[Path] = typer.Option(None, "--analysis-result", help="patch payload가 들어있는 analysis_result.json 경로입니다."),
    scan_id: Optional[int] = typer.Option(None, "--scan-id", help="해당 백엔드 scanId의 analysis_result.json을 내려받아 적용합니다."),
    latest: bool = typer.Option(False, "--latest", help="선택한 프로젝트의 최신 DONE 스캔 결과를 내려받아 적용합니다."),
    project_id: Optional[int] = typer.Option(None, "--project-id", help="--latest에서 사용할 프로젝트 ID입니다. 생략하면 저장된 agent projectId를 사용합니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="analysis_result 다운로드에 사용할 SSAfer 백엔드 API URL입니다."),
    patch_id: Optional[str] = typer.Option(None, "--patch-id", help="특정 patchId 하나만 적용합니다."),
    dry_run: bool = typer.Option(False, "--dry-run", help="파일을 바꾸지 않고 적용 가능 여부와 diff만 확인합니다."),
    yes: bool = typer.Option(False, "--yes", "-y", help="확인 질문 없이 바로 적용합니다."),
) -> None:
    """AI 분석 결과의 patch payload를 로컬 파일에 적용합니다."""
    from ssafer.core.patches import (
        PatchCandidate,
        PatchError,
        apply_patch_candidates,
        load_patch_candidates_from_file,
    )

    try:
        project_root = path.resolve()
        effective_scan_id = scan_id_arg if scan_id_arg is not None else scan_id
        remote_scan_id = effective_scan_id
        remote_options = sum(1 for enabled in (analysis_result is not None, effective_scan_id is not None, latest) if enabled)
        if remote_options > 1:
            raise PatchError("Use only one of scanId argument, --analysis-result, --scan-id, or --latest.")
        if latest or (analysis_result is None and effective_scan_id is None):
            scan_id = _latest_done_scan_id_or_exit(project_root, project_id=project_id, api_url=api_url)
            remote_scan_id = scan_id
            analysis_path = _download_analysis_result_or_exit(project_root, scan_id=scan_id, api_url=api_url)
        elif effective_scan_id is not None:
            analysis_path = _download_analysis_result_or_exit(project_root, scan_id=effective_scan_id, api_url=api_url)
        else:
            analysis_path = analysis_result
        if analysis_path is None:
            raise PatchError(
                "analysis_result.json을 찾지 못했습니다. --analysis-result로 경로를 지정하거나 "
                "--scan-id/--latest로 백엔드 분석 결과를 내려받으세요."
            )
        console.print(f"[dim]Analysis result: {analysis_path}[/dim]")
        if analysis_result is not None and effective_scan_id is None and not latest and not yes:
            console.print(
                "[yellow]로컬 analysis_result.json을 사용합니다. "
                "현재 프로젝트의 분석 결과가 맞는지 확인해 주세요.[/yellow]"
            )
            if not typer.confirm("계속 진행할까요?"):
                console.print("[yellow]수정 적용을 취소했습니다.[/yellow]")
                raise typer.Exit(code=1)

        candidates = load_patch_candidates_from_file(analysis_path)
        if not candidates:
            console.print("[yellow]적용할 자동 수정안이 없습니다.[/yellow]")
            console.print(
                "[dim]파일은 변경하지 않았습니다. AI가 patch payload를 만들지 않은 결과입니다. "
                "웹 결과나 analysis_result.json의 권장 조치를 확인해 주세요.[/dim]"
            )
            if remote_scan_id is not None:
                console.print(f"[dim]웹 결과: {_apply_web_scan_url(project_root, api_url, remote_scan_id)}[/dim]")
            return

        selected = [candidate for candidate in candidates if patch_id is None or candidate.patch_id == patch_id]
        if not selected:
            raise PatchError(f"patchId를 찾지 못했습니다: {patch_id}")

        selected = _select_patch_candidates(selected, project_root=project_root, patch_id=patch_id, yes=yes)
        _print_patch_preview(selected)

        if not dry_run and not yes:
            confirmed = typer.confirm("선택한 수정안을 적용할까요?")
            if not confirmed:
                console.print("[yellow]수정 적용을 취소했습니다. 파일은 변경하지 않았습니다.[/yellow]")
                raise typer.Exit(code=1)

        selected_patch_id = selected[0].patch_id if len(selected) == 1 else None
        selected_candidates = selected if selected_patch_id is None else candidates
        results = apply_patch_candidates(
            project_root,
            selected_candidates,
            patch_id=selected_patch_id,
            dry_run=dry_run,
            allow_hash_mismatch_if_text_matches=True,
        )
    except (OSError, ValueError, PatchError, RuntimeError) as exc:
        console.print(f"[red]수정 적용 실패:[/red] {exc}")
        raise typer.Exit(code=1) from exc

    result_table = Table(title="수정 적용 결과")
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


@app.command("agent-watch", hidden=True)
def agent_watch(
    path: Path = typer.Option(Path("."), "--path", "-p", help="agent가 작업할 프로젝트 루트입니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="SSAfer 백엔드 API URL입니다."),
    agent_id: Optional[int] = typer.Option(None, "--agent-id", help="백엔드에서 발급한 Local Agent ID입니다."),
    project_id: Optional[int] = typer.Option(None, "--project-id", help="이 agent가 연결될 프로젝트 ID입니다."),
    agent_token: Optional[str] = typer.Option(None, "--agent-token", help="백엔드에서 발급한 agent 인증 토큰입니다."),
    interval: float = typer.Option(5.0, "--interval", help="WebSocket 알림이 없을 때 사용할 보조 확인 주기입니다."),
    once: bool = typer.Option(False, "--once", help="연결 후 pending task를 한 번만 확인하고 종료합니다."),
    dry_run: bool = typer.Option(False, "--dry-run", help="파일을 바꾸지 않고 agent task 처리 가능 여부만 확인합니다."),
    reconnect: bool = typer.Option(True, "--reconnect/--no-reconnect", help="agent 연결이 끊기면 자동으로 재연결합니다."),
    max_retries: Optional[int] = typer.Option(None, "--max-retries", help="최대 재연결 횟수입니다. 생략하면 계속 재시도합니다."),
    reconnect_max_delay: float = typer.Option(30.0, "--reconnect-max-delay", help="재연결 대기 시간의 최대값(초)입니다."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="연결 payload, pending task 조회 같은 상세 로그를 출력합니다."),
) -> None:
    """Local Agent를 연결하고 pending task를 처리합니다."""
    _run_agent_watch(
        path=path,
        api_url=api_url,
        agent_id=agent_id,
        project_id=project_id,
        agent_token=agent_token,
        interval=interval,
        once=once,
        dry_run=dry_run,
        reconnect=reconnect,
        max_retries=max_retries,
        reconnect_max_delay=reconnect_max_delay,
        verbose=verbose,
    )


@app.command("agent", help="웹 요청을 현재 PC/서버에서 처리하도록 Local Agent를 연결합니다.", rich_help_panel="로컬 Agent")
def agent(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="agent 연결, heartbeat, task 조회 상세 로그를 출력합니다."),
    path: Path = typer.Option(Path("."), "--path", "-p", help="agent가 연결될 프로젝트 루트입니다."),
) -> None:
    """Local Agent를 설정하고 웹 요청을 처리할 수 있게 실행합니다."""
    _start_agent(path=path, verbose=verbose)


def _start_agent(*, path: Path, refresh_token: bool = False, verbose: bool = False) -> None:
    from ssafer.core.auth import load_agent_config, load_endpoint, load_token

    project_root = path.resolve()
    agent_config = load_agent_config(project_root)
    endpoint = load_endpoint()
    access_token = load_token()
    if access_token is None:
        console.print("[red]로그인이 필요합니다. 먼저 ssafer login을 실행하세요.[/red]")
        raise typer.Exit(code=1)

    saved_project_id = _saved_agent_project_id(agent_config)
    project_id = _select_agent_project_id(endpoint, access_token, saved_project_id=saved_project_id)
    if not refresh_token and _has_saved_agent_config(agent_config) and saved_project_id == project_id:
        console.print("[green]저장된 Agent 설정을 사용합니다.[/green]")
    else:
        agent_config = _issue_and_save_agent_token(
            project_id,
            endpoint,
            "Agent setup",
            access_token=access_token,
            project_root=project_root,
        )
        console.print("[green]Agent 설정 완료.[/green]")
    _run_agent_watch(
        path=project_root,
        api_url=None,
        agent_id=None,
        project_id=None,
        agent_token=None,
        interval=5.0,
        once=False,
        dry_run=False,
        reconnect=True,
        max_retries=None,
        reconnect_max_delay=30.0,
        verbose=verbose,
        agent_config=agent_config,
    )


@app.command("agent-init", hidden=True)
def agent_init(
    project_id: int = typer.Option(..., "--project-id", help="agent token을 발급받을 프로젝트 ID입니다."),
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer 백엔드 API URL입니다."),
) -> None:
    """프로젝트용 Local Agent 토큰을 발급받아 저장합니다."""
    from ssafer.core.auth import load_endpoint

    effective_endpoint = endpoint or load_endpoint()
    agent_data = _issue_and_save_agent_token(project_id, effective_endpoint, "Agent init")

    console.print("[green]Agent 토큰 저장 완료.[/green]")
    console.print(f"agentId: {agent_data.get('agentId')}")
    console.print(f"projectId: {agent_data.get('projectId')}")
    console.print("[dim]ssafer agent를 실행하면 웹 요청을 받을 수 있습니다.[/dim]")


@app.command("project-create", hidden=True)
def project_create(
    name: Optional[str] = typer.Option(None, "--name", help="생성할 프로젝트 이름입니다. 생략하면 현재 폴더명을 기본값으로 사용합니다."),
    description: Optional[str] = typer.Option(None, "--description", help="프로젝트 설명입니다."),
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer 백엔드 API URL입니다."),
) -> None:
    """로그인한 계정에 SSAfer 프로젝트를 생성합니다."""
    from ssafer.core.auth import create_project, load_endpoint, load_token

    effective_endpoint = endpoint or load_endpoint()
    access_token = load_token()
    if access_token is None:
        console.print("[red]로그인이 필요합니다. 먼저 ssafer login을 실행하세요.[/red]")
        raise typer.Exit(code=1)
    if name is None:
        console.print("[cyan]SSAfer 웹과 CLI가 함께 사용할 프로젝트를 생성합니다.[/cyan]")
        console.print("[dim]프로젝트는 스캔 기록, 분석 결과, Local Agent 연결 상태를 묶는 단위입니다.[/dim]")
        console.print("[cyan]새 프로젝트 이름을 입력하세요. 그냥 Enter를 누르면 현재 폴더명을 사용합니다.[/cyan]")
        project_name = typer.prompt("프로젝트 이름", default=Path.cwd().name)
    else:
        project_name = name
    if not project_name.strip():
        console.print("[red]프로젝트 이름을 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        project = create_project(
            effective_endpoint,
            access_token,
            name=project_name.strip(),
            description=description,
        )
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]프로젝트 생성 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]프로젝트 생성 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    project_id = project.get("projectId") or project.get("id")
    if project_id is None:
        console.print("[red]프로젝트 생성 실패:[/red] 백엔드 응답에 projectId가 없습니다.")
        raise typer.Exit(code=1)
    console.print(f"[green]프로젝트 생성 완료.[/green] projectId={project_id}")
    _print_project_web_link(effective_endpoint, project_id)


def _has_saved_agent_config(config: dict) -> bool:
    return bool(config.get("agentId") and config.get("projectId") and config.get("agentToken"))


def _saved_agent_project_id(config: dict) -> int | None:
    value = config.get("projectId")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _issue_and_save_agent_token(
    project_id: int,
    endpoint: str,
    label: str,
    *,
    access_token: str | None = None,
    project_root: Path | None = None,
) -> dict:
    from ssafer.core.auth import issue_project_agent_token, load_token, save_agent_config

    effective_access_token = access_token or load_token()
    if effective_access_token is None:
        console.print("[red]로그인이 필요합니다. 먼저 ssafer login을 실행하세요.[/red]")
        raise typer.Exit(code=1)

    try:
        agent_data = issue_project_agent_token(endpoint, project_id, effective_access_token)
        save_agent_config(agent_data, endpoint, project_root)
        return agent_data
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]{label} failed:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]{label} failed:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    except ValueError as exc:
        console.print(f"[red]{label} failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc


def _select_agent_project_id(endpoint: str, access_token: str, *, saved_project_id: int | None = None) -> int:
    from ssafer.core.auth import create_project, list_projects

    def _project_id_as_int(value: object) -> int | None:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _prompt_project_id(*, default_project_id: int | None = None) -> int:
        if default_project_id is None:
            return typer.prompt("프로젝트 ID", type=int)
        return typer.prompt("프로젝트 ID", type=int, default=default_project_id)

    def create_agent_project() -> int:
        console.print("[cyan]새 프로젝트 이름을 입력하세요. 그냥 Enter를 누르면 현재 폴더명을 사용합니다.[/cyan]")
        name = typer.prompt("프로젝트 이름", default=Path.cwd().name)
        if not name.strip():
            console.print("[red]프로젝트 이름을 입력해야 합니다.[/red]")
            raise typer.Exit(code=1)
        try:
            project = create_project(endpoint, access_token, name=name.strip())
        except httpx.HTTPStatusError as exc:
            console.print(f"[red]프로젝트 생성 실패:[/red] {_format_http_error(exc)}")
            raise typer.Exit(code=1) from exc
        except httpx.HTTPError as exc:
            console.print(f"[red]프로젝트 생성 실패:[/red] {_format_http_transport_error(exc)}")
            raise typer.Exit(code=1) from exc
        project_id = project.get("projectId") or project.get("id")
        if project_id is None:
            console.print("[red]프로젝트 생성 실패:[/red] 백엔드 응답에 projectId가 없습니다.")
            raise typer.Exit(code=1)
        console.print(f"[green]프로젝트 생성 완료.[/green] projectId={project_id}")
        _print_project_web_link(endpoint, project_id)
        return int(project_id)

    try:
        projects = list_projects(endpoint, access_token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[yellow]프로젝트 목록 조회 실패:[/yellow] {_format_http_error(exc)}")
        console.print("[dim]웹에서 만든 프로젝트의 ID를 알고 있다면 직접 입력할 수 있습니다.[/dim]")
        return _prompt_project_id(default_project_id=saved_project_id)
    except httpx.HTTPError as exc:
        console.print(f"[yellow]프로젝트 목록 조회 실패:[/yellow] {_format_http_transport_error(exc)}")
        console.print("[dim]웹에서 만든 프로젝트의 ID를 알고 있다면 직접 입력할 수 있습니다.[/dim]")
        return _prompt_project_id(default_project_id=saved_project_id)

    if not projects:
        console.print("[yellow]이 계정에 연결된 SSAfer 프로젝트가 아직 없습니다.[/yellow]")
        console.print(
            "[dim]Local Agent는 어느 웹 프로젝트의 요청을 처리할지 알아야 해서 프로젝트가 필요합니다. "
            "프로젝트를 만들면 웹에서도 같은 프로젝트로 스캔 기록과 agent 상태를 볼 수 있습니다.[/dim]"
        )
        if not typer.confirm("지금 이 폴더용 프로젝트를 새로 만들까요?", default=True):
            console.print(
                "[yellow]먼저 SSAfer 웹에서 프로젝트를 만들거나 참여한 뒤 "
                "[bold]ssafer agent[/bold]를 다시 실행하세요.[/yellow]"
            )
            raise typer.Exit(code=1)
        return create_agent_project()

    console.print("[cyan]Local Agent를 연결할 프로젝트를 선택하세요.[/cyan]")
    console.print("[dim]웹에서 이 프로젝트로 보낸 스캔/수정 요청을 현재 PC 또는 서버의 agent가 처리합니다.[/dim]")
    project_table = Table(title="프로젝트 목록")
    project_table.add_column("선택 번호", justify="right")
    project_table.add_column("프로젝트 이름")
    project_table.add_column("projectId", justify="right")
    default_index = 1
    for index, project in enumerate(projects, start=1):
        project_id = project.get("projectId") or project.get("id")
        name = project.get("name") or "(unnamed)"
        if saved_project_id is not None and _project_id_as_int(project_id) == saved_project_id:
            default_index = index
            name = f"{name} (현재 연결)"
        project_table.add_row(str(index), str(name), str(project_id or "-"))
    create_index = len(projects) + 1
    project_table.add_row(str(create_index), "새 프로젝트 만들기", "-")
    console.print(f"[dim]아래 표의 선택 번호를 입력하세요. Enter를 누르면 {default_index}번을 선택합니다.[/dim]")
    console.print(project_table)

    while True:
        selected = typer.prompt("선택 번호", default=str(default_index), show_default=False)
        if selected.isdigit():
            index = int(selected)
            if 1 <= index <= len(projects):
                project = projects[index - 1]
                project_id = project.get("projectId") or project.get("id")
                if project_id is not None:
                    return int(project_id)
            if index == create_index:
                return create_agent_project()
        console.print(f"[red]목록 왼쪽의 선택 번호를 입력해 주세요. 예: 1 또는 {create_index}[/red]")


def _run_agent_watch(
    *,
    path: Path,
    api_url: Optional[str],
    agent_id: Optional[int],
    project_id: Optional[int],
    agent_token: Optional[str],
    interval: float,
    once: bool,
    dry_run: bool,
    reconnect: bool,
    max_retries: Optional[int],
    reconnect_max_delay: float,
    verbose: bool,
    agent_config: Optional[dict] = None,
) -> None:
    from ssafer.core.agent import AgentTaskResult, watch_agent
    from ssafer.core.auth import load_agent_config, load_endpoint, load_token

    project_root = path.resolve()
    config = agent_config if agent_config is not None else load_agent_config(project_root)
    effective_url = api_url or config.get("endpoint") or load_endpoint()
    effective_agent_id = agent_id or _load_int_config_or_env(config, "agentId", "SSAFER_AGENT_ID", "agent ID")
    effective_project_id = project_id or _load_int_config_or_env(config, "projectId", "SSAFER_PROJECT_ID", "project ID")
    effective_agent_token = agent_token or os.getenv("SSAFER_AGENT_TOKEN") or config.get("agentToken")
    effective_upload_token = load_token()
    if not effective_agent_token:
        console.print("[red]Agent 토큰이 없습니다. ssafer agent로 설정하거나 --agent-token을 지정하세요.[/red]")
        raise typer.Exit(code=1)

    console.print(
        f"[green]Local Agent 실행 중[/green] projectId={effective_project_id}"
    )
    console.print(f"웹 프로젝트: {_web_project_url(effective_url, effective_project_id)}")
    console.print(f"[dim]스캔 기준 경로: {project_root}[/dim]")
    console.print("[dim]웹에서 이 프로젝트로 스캔/수정 요청을 보내면 이 터미널에서 처리합니다. 종료하려면 Ctrl+C를 누르세요.[/dim]")
    if project_root.name.lower() == "cli":
        console.print(
            "[yellow]현재 CLI 폴더에서 agent를 실행 중입니다. "
            "전체 프로젝트를 점검하려면 프로젝트 루트에서 ssafer agent를 실행하거나 --path .. 를 사용하세요.[/yellow]"
        )
    if verbose:
        console.print(f"[dim]agentId={effective_agent_id}, path={project_root}[/dim]")
        if once:
            console.print("[dim]Mode: pending task를 한 번만 확인하고 종료합니다.[/dim]")
        else:
            console.print("[dim]Mode: WebSocket task 알림을 기다립니다.[/dim]")
            if reconnect:
                retry_label = "unlimited" if max_retries is None else str(max_retries)
                console.print(
                    f"[dim]Reconnect: enabled, max retries={retry_label}, "
                    f"max delay={reconnect_max_delay:g}s.[/dim]"
                )
            else:
                console.print("[yellow]자동 재연결이 꺼져 있습니다. 연결이 끊기면 agent가 종료됩니다.[/yellow]")
    if dry_run:
        console.print("[yellow]Dry-run 모드입니다. 파일은 변경하지 않습니다.[/yellow]")

    live_status = None

    def _update_live_status(message: str) -> None:
        nonlocal live_status
        if verbose:
            return
        if live_status is None:
            live_status = console.status(f"[cyan]{message}[/cyan]", spinner="dots")
            live_status.start()
            return
        live_status.update(f"[cyan]{message}[/cyan]")

    def _stop_live_status() -> None:
        nonlocal live_status
        if live_status is None:
            return
        live_status.stop()
        live_status = None

    def on_event(event_type: str, payload: object) -> None:
        if event_type == "connected":
            if verbose:
                console.print(f"[green]Agent connected.[/green] {payload}")
            else:
                console.print("[green]Agent 연결 완료. 요청 대기 중입니다.[/green]")
            return
        if event_type == "checking_tasks":
            if verbose:
                console.print("[cyan]Checking pending tasks...[/cyan]")
            return
        if event_type == "tasks_found":
            tasks = payload if isinstance(payload, list) else []
            if not tasks:
                if once:
                    console.print("[dim]처리할 pending task가 없습니다.[/dim]")
                elif verbose:
                    console.print("[dim]처리할 pending task가 없습니다. Agent가 계속 대기합니다.[/dim]")
                return
            task_types = _format_agent_task_summary(tasks)
            console.print(f"[cyan]처리할 task {len(tasks)}개를 찾았습니다.[/cyan] {task_types}")
            return
        if event_type == "watching":
            if verbose:
                console.print("[dim]Waiting for WebSocket task notifications.[/dim]")
            return
        if event_type == "task_available":
            console.print("[cyan]새 작업을 받았습니다. 처리할 task를 확인합니다.[/cyan]")
            return
        if event_type == "disconnected":
            error = "-"
            attempt = "-"
            if isinstance(payload, dict):
                error = str(payload.get("error", "-"))
                attempt = str(payload.get("attempt", "-"))
            if verbose:
                console.print(f"[yellow]Agent connection lost.[/yellow] attempt={attempt}, error={error}")
            else:
                console.print("[yellow]Agent 연결이 끊겼습니다. 자동 재연결을 시도합니다.[/yellow]")
            return
        if event_type == "reconnecting":
            attempt = "-"
            delay = "-"
            if isinstance(payload, dict):
                attempt = str(payload.get("attempt", "-"))
                delay = str(payload.get("delaySeconds", "-"))
            if verbose:
                console.print(f"[cyan]Reconnecting agent...[/cyan] attempt={attempt}, next retry in {delay}s")
            return
        if event_type == "reconnect_gave_up":
            attempt = "-"
            error = "-"
            if isinstance(payload, dict):
                attempt = str(payload.get("attempt", "-"))
                error = str(payload.get("error", "-"))
            console.print(f"[red]Agent 재연결을 중단했습니다.[/red] attempts={attempt}, error={error}")
            return
        if event_type == "auth_failed":
            error = "-"
            if isinstance(payload, dict):
                error = str(payload.get("error", "-"))
            console.print(f"[red]Agent 인증 실패:[/red] {error}")
            console.print(
                "[yellow]저장된 agent 토큰이 유효하지 않습니다. "
                "[bold]ssafer login --endpoint https://ssafer.co.kr[/bold] 후 agent를 다시 시작하세요.[/yellow]"
            )
            return
        if event_type == "ping":
            if verbose:
                console.print(f"[dim]Agent heartbeat acknowledged.[/dim] {payload}")
            return
        if event_type == "task_result_reported":
            task_id = "-"
            count = "-"
            if isinstance(payload, dict):
                task_id = str(payload.get("taskId", "-"))
                count = str(payload.get("count", "-"))
            if verbose:
                console.print(f"[green]Agent task 결과 보고 완료.[/green] taskId={task_id}, count={count}")
            return
        if event_type == "task_result_report_failed":
            task_id = "-"
            error = "-"
            if isinstance(payload, dict):
                task_id = str(payload.get("taskId", "-"))
                error = str(payload.get("error", "-"))
            console.print(f"[yellow]Agent task 결과 보고 실패.[/yellow] taskId={task_id}, error={error}")
            return
        if event_type == "task_step":
            task_id = "-"
            scan_id = "-"
            task_type = "-"
            message = "-"
            if isinstance(payload, dict):
                task_id = str(payload.get("taskId", "-"))
                scan_id = str(payload.get("scanId", "-"))
                task_type = str(payload.get("taskType", "-"))
                message = str(payload.get("message", "-"))
            if task_type == "PATCH_APPLY":
                _stop_live_status()
                console.print(f"[cyan]Agent apply 진행 중...[/cyan] taskId={task_id}: {message}")
                return
            action_label = "Agent apply" if task_type == "PATCH_APPLY" else "Agent scan"
            if verbose:
                if task_type == "PATCH_APPLY":
                    console.print(f"[cyan]{action_label} 진행 중[/cyan] taskId={task_id}: {message}")
                else:
                    console.print(f"[cyan]{action_label} 진행 중[/cyan] taskId={task_id}, scanId={scan_id}: {message}")
            else:
                if task_type == "PATCH_APPLY":
                    _update_live_status(f"{action_label} 진행 중... taskId={task_id} · {message}")
                else:
                    _update_live_status(f"{action_label} 진행 중... scanId={scan_id} · {message}")
            return
        if event_type == "analysis_wait_started":
            scan_id = str(payload.get("scanId", "-")) if isinstance(payload, dict) else "-"
            if verbose:
                console.print(f"[cyan]AI 분석 완료를 기다리는 중...[/cyan] scanId={scan_id}")
            else:
                _update_live_status(f"AI 분석 완료를 기다리는 중... scanId={scan_id}")
            return
        if event_type == "analysis_status":
            if isinstance(payload, dict):
                message = (
                    f"AI 분석 진행 중... scanId={payload.get('scanId', '-')}, "
                    f"상태={payload.get('status', '-')}, 단계={payload.get('progressStep') or '-'}"
                )
                if verbose:
                    console.print(f"[cyan]{message}[/cyan]")
                else:
                    _update_live_status(message)
            return
        if event_type == "analysis_status_retry":
            if isinstance(payload, dict):
                message = f"AI 분석 상태 조회 재시도 중... scanId={payload.get('scanId', '-')}, count={payload.get('count', '-')}"
                if verbose:
                    console.print(f"[yellow]{message}[/yellow]")
                else:
                    _update_live_status(message)
            return
        if event_type == "analysis_status_failed":
            _stop_live_status()
            error = "-"
            scan_id = "-"
            if isinstance(payload, dict):
                scan_id = str(payload.get("scanId", "-"))
                error = str(payload.get("error", "-"))
            console.print(f"[yellow]AI 분석 상태를 확인하지 못했습니다.[/yellow] scanId={scan_id}, error={error}")
            return
        if event_type == "analysis_done":
            _stop_live_status()
            scan_id = str(payload.get("scanId", "-")) if isinstance(payload, dict) else "-"
            console.print(f"[green]AI 분석 완료.[/green] 결과: {_web_url(effective_url, f'/scans/{scan_id}')}")
            return
        if event_type == "analysis_failed":
            _stop_live_status()
            scan_id = "-"
            status_value = "-"
            error_message = None
            if isinstance(payload, dict):
                scan_id = str(payload.get("scanId", "-"))
                status_value = str(payload.get("status", "-"))
                error_message = payload.get("errorMessage")
            console.print(f"[red]AI 분석이 완료되지 못했습니다.[/red] scanId={scan_id}, 상태={status_value}")
            if error_message:
                console.print(f"[yellow]{error_message}[/yellow]")
            return
        if event_type == "analysis_timeout":
            _stop_live_status()
            scan_id = str(payload.get("scanId", "-")) if isinstance(payload, dict) else "-"
            console.print(f"[yellow]AI 분석 대기 시간이 초과되었습니다.[/yellow] 결과: {_web_url(effective_url, f'/scans/{scan_id}')}")
            return
        if isinstance(payload, AgentTaskResult):
            _stop_live_status()
            if (
                not verbose
                and payload.task_type == "SCAN_REQUEST"
                and payload.status.upper() == "SUCCESS"
            ):
                scan_id = payload.scan_id if payload.scan_id is not None else "-"
                scan_type = payload.scan_type or "-"
                console.print(f"[green]Agent scan 업로드 완료.[/green] scanId={scan_id}, scanType={scan_type}")
                return
            _print_agent_task_result(payload)

    try:
        asyncio.run(
            watch_agent(
                api_url=effective_url,
                agent_id=effective_agent_id,
                project_id=effective_project_id,
                agent_token=effective_agent_token,
                upload_token=effective_upload_token,
                project_root=project_root,
                interval_seconds=interval,
                once=once,
                dry_run=dry_run,
                reconnect=reconnect,
                max_retries=max_retries,
                reconnect_max_delay_seconds=reconnect_max_delay,
                on_event=on_event,
            )
        )
    except KeyboardInterrupt:
        console.print("[yellow]Agent를 종료했습니다.[/yellow]")
    except Exception as exc:  # noqa: BLE001
        console.print(f"[red]Agent watch failed:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    finally:
        _stop_live_status()


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


def _load_int_config_or_env(config: dict, key: str, env_name: str, label: str) -> int:
    value = config.get(key)
    if value is not None:
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            console.print(f"[red]Saved agent {label} must be an integer.[/red]")
            raise typer.Exit(code=1) from exc
    return _load_int_env(env_name, label)


def _print_agent_task_result(result: "AgentTaskResult") -> None:
    if result.task_type == "SCAN_REQUEST":
        _print_scan_request_task_result(result)
        return

    table = Table(title=f"Agent task #{result.task_id} result")
    table.add_column("Task Type")
    table.add_column("Patch ID")
    table.add_column("Status")
    table.add_column("File", overflow="fold")
    table.add_column("Message", overflow="fold")

    if not result.patch_results:
        table.add_row(result.task_type, "-", result.status, "-", _format_agent_task_message(result))
    else:
        for patch_result in result.patch_results:
            table.add_row(
                result.task_type,
                patch_result.patch_id,
                patch_result.status,
                patch_result.file_path,
                patch_result.message,
            )
    console.print(table)
    _print_patch_apply_summary(result)


def _print_patch_apply_summary(result: "AgentTaskResult") -> None:
    if result.task_type != "PATCH_APPLY" or result.status == "DRY_RUN":
        return

    success_count = sum(1 for patch_result in result.patch_results if patch_result.status == "SUCCESS")
    failed_count = sum(1 for patch_result in result.patch_results if patch_result.status == "FAILED")

    if result.status == "SUCCESS":
        console.print(f"[green]\ud328\uce58 \uc801\uc6a9 \uc644\ub8cc.[/green] applied={success_count}")
        return
    if result.status == "FAILED":
        console.print(f"[red]\ud328\uce58 \uc801\uc6a9 \uc2e4\ud328.[/red] failed={failed_count or '-'}")


def _print_scan_request_task_result(result: "AgentTaskResult") -> None:
    table = Table(title=f"Agent scan task #{result.task_id} result")
    table.add_column("Task Type")
    table.add_column("Scan ID", justify="right")
    table.add_column("Scan Type")
    table.add_column("Status")
    table.add_column("Message", overflow="fold")
    table.add_row(
        result.task_type,
        _format_agent_scan_id(result),
        result.scan_type or _infer_agent_scan_type(result.message),
        result.status,
        _format_agent_task_message(result),
    )
    console.print(table)


def _format_agent_scan_id(result: "AgentTaskResult") -> str:
    if result.scan_id is not None:
        return str(result.scan_id)
    match = re.search(r"scanId=(\d+)", result.message)
    if match:
        return match.group(1)
    match = re.search(r"/api/v1/scans/(\d+)/", result.message)
    return match.group(1) if match else "-"


def _infer_agent_scan_type(message: str) -> str:
    match = re.search(r"\b(PROJECT_FILE|PROJECT_SCAN|LOCAL_SCAN|SERVER_AUDIT)\b", message)
    return match.group(1) if match else "-"


def _format_agent_task_summary(tasks: list[object]) -> str:
    counts = Counter(str(getattr(task, "task_type", "UNKNOWN")) for task in tasks)
    return ", ".join(f"{task_type} {count}개" for task_type, count in sorted(counts.items()))


def _format_agent_task_message(result: "AgentTaskResult") -> str:
    message = result.message
    if result.task_type != "SCAN_REQUEST":
        return message

    match = re.search(r"Client error '(\d{3}) '\s+for url\s+'([^']+)'", message)
    if not match:
        return message

    status_code, url = match.groups()
    scan_id_match = re.search(r"/api/v1/scans/(\d+)/raw-results", url)
    scan_id = scan_id_match.group(1) if scan_id_match else "-"
    if status_code == "409" and "/raw-results" in url:
        return (
            f"scanId={scan_id} 결과 업로드 완료 보고가 거절되었습니다(409). "
            "이미 완료/실패된 스캔이거나 오래된 agent task일 수 있습니다."
        )
    return f"SCAN_REQUEST HTTP {status_code} 오류: {url}"


def _select_patch_candidates(
    candidates: list["PatchCandidate"],
    *,
    project_root: Path,
    patch_id: str | None,
    yes: bool,
) -> list["PatchCandidate"]:
    table = Table(title="Applicable patch candidates")
    table.add_column("No.", justify="right")
    table.add_column("Finding ID")
    table.add_column("File", overflow="fold")
    table.add_column("Line", justify="right")
    table.add_column("Change", overflow="fold")
    table.add_column("Operation")
    for index, candidate in enumerate(candidates, start=1):
        table.add_row(
            str(index),
            candidate.finding_id or "-",
            candidate.file_path,
            _find_patch_candidate_line(project_root, candidate),
            _format_patch_candidate_change(candidate),
            candidate.operation,
        )
    if len(candidates) > 1 and patch_id is None:
        table.add_row(str(len(candidates) + 1), "-", "Apply all patch candidates", "-", "-", "-")
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


def _find_patch_candidate_line(project_root: Path, candidate: "PatchCandidate") -> str:
    if candidate.operation == "append":
        return "EOF"
    if not candidate.old_text:
        return "-"

    try:
        root = project_root.resolve()
        target = (root / candidate.file_path).resolve()
        target.relative_to(root)
        content = target.read_text(encoding="utf-8")
    except (OSError, ValueError, UnicodeDecodeError):
        return "-"

    index = content.find(candidate.old_text)
    if index < 0:
        return "-"
    return str(content.count("\n", 0, index) + 1)


def _format_patch_candidate_change(candidate: "PatchCandidate") -> str:
    if candidate.operation == "append":
        return f"+ {_first_patch_line(candidate.new_text)}"
    if candidate.old_text is None:
        return f"+ {_first_patch_line(candidate.new_text)}"
    return f"- {_first_patch_line(candidate.old_text)}\n+ {_first_patch_line(candidate.new_text)}"


def _first_patch_line(value: str, *, max_length: int = 90) -> str:
    compact = " ".join(line.strip() for line in value.splitlines() if line.strip())
    if not compact:
        compact = value.strip().replace("\n", " ")
    if not compact:
        return ""
    if len(compact) <= max_length:
        return compact
    return compact[: max_length - 3] + "..."


def _print_patch_preview(candidates: list["PatchCandidate"]) -> None:
    table = Table(title="Patch diff preview")
    table.add_column("Patch ID")
    table.add_column("Finding ID")
    table.add_column("File", overflow="fold")
    table.add_column("Diff", overflow="fold")
    for candidate in candidates:
        table.add_row(
            candidate.patch_id,
            candidate.finding_id or "-",
            candidate.file_path,
            _format_patch_diff(candidate.old_text, candidate.new_text, operation=candidate.operation),
        )
    console.print(table)


def _format_patch_diff(old_text: str | None, new_text: str, *, operation: str = "replace") -> str:
    if operation == "append":
        return "\n".join(f"+ {line}" for line in new_text.splitlines()) or "+ "
    if old_text is None:
        return "\n".join(f"+ {line}" for line in new_text.splitlines()) or "+ "
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()
    if len(old_lines) <= 1 and len(new_lines) <= 1:
        return f"- {old_text}\n+ {new_text}"
    diff_lines = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile="oldText",
        tofile="newText",
        lineterm="",
    )
    return "\n".join(diff_lines)


@app.command(help="계정을 연결하고 업로드/Agent 실행에 필요한 토큰을 저장합니다.", rich_help_panel="계정/상태")
def login(
    show_url: bool = typer.Option(False, "--show-url", help="게스트 웹 이어보기 URL의 토큰 원문을 출력합니다."),
    guest_token: Optional[str] = typer.Option(None, "--guest-token", help="웹에서 발급받은 게스트 토큰을 CLI에 저장합니다."),
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="로그인할 SSAfer 백엔드 API URL입니다."),
    logout: bool = typer.Option(False, "--logout", help="저장된 로그인 토큰을 삭제합니다. 가능하면 ssafer logout 사용을 권장합니다."),
    guest: bool = typer.Option(False, "--guest", help="이메일 없이 게스트 토큰을 발급받아 CLI를 사용합니다."),
) -> None:
    """SSAfer 서버에 로그인하고 토큰을 저장합니다."""
    from ssafer.core.auth import (
        clear_token,
        enter_guest_mode,
        load_auth_identity,
        load_endpoint,
        login_with_credentials,
        save_auth_tokens,
    )

    if logout:
        clear_token()
        console.print("[green]로그아웃 완료. 저장된 토큰이 삭제되었습니다.[/green]")
        return

    effective_endpoint = endpoint or load_endpoint()
    previous_auth_mode, previous_auth_subject = load_auth_identity()
    if guest and guest_token:
        console.print("[red]--guest와 --guest-token은 함께 사용할 수 없습니다.[/red]")
        raise typer.Exit(code=1)
    if guest_token:
        token = guest_token.strip()
        if not token:
            console.print("[red]게스트 토큰이 비어 있습니다.[/red]")
            raise typer.Exit(code=1)
        try:
            save_auth_tokens({"guestAccessToken": token}, effective_endpoint)
            _clear_agent_config_if_auth_changed(previous_auth_mode, previous_auth_subject)
        except ValueError as exc:
            console.print(f"[red]게스트 토큰 저장 실패:[/red] {exc}")
            raise typer.Exit(code=1) from exc
        console.print("[green]웹 게스트 토큰을 CLI에 저장했습니다.[/green]")
        console.print("[dim]이제 ssafer upload, ssafer agent 같은 명령에서 같은 게스트 세션을 사용합니다.[/dim]")
        _print_guest_web_hint(effective_endpoint)
        _prompt_start_agent_after_login()
        return
    if guest:
        try:
            auth_data = enter_guest_mode(effective_endpoint)
            save_auth_tokens(auth_data, effective_endpoint)
            _clear_agent_config_if_auth_changed(previous_auth_mode, previous_auth_subject)
        except httpx.HTTPStatusError as exc:
            console.print(f"[red]게스트 로그인 실패:[/red] {_format_http_error(exc)}")
            raise typer.Exit(code=1) from exc
        except httpx.HTTPError as exc:
            console.print(f"[red]게스트 로그인 실패:[/red] {_format_http_transport_error(exc)}")
            raise typer.Exit(code=1) from exc
        except ValueError as exc:
            console.print(f"[red]게스트 로그인 실패:[/red] {exc}")
            raise typer.Exit(code=1) from exc
        console.print("[green]게스트 로그인 완료. 토큰은 ~/.ssafer/config.yml에 저장됩니다.[/green]")
        console.print("[dim]게스트 토큰은 현재 CLI에서 만든 게스트 프로젝트/스캔에만 사용할 수 있습니다.[/dim]")
        guest_access_token = auth_data.get("guestAccessToken")
        if guest_access_token:
            continue_url = _guest_continue_url(effective_endpoint, str(guest_access_token))
            if show_url:
                console.print(f"웹에서 이어 보기: [link={escape(continue_url)}]{escape(continue_url)}[/link]")
                console.print("[yellow]URL에 게스트 토큰이 포함되어 있습니다. 다른 사람에게 공유하지 마세요.[/yellow]")
            else:
                console.print("[dim]웹에서 이어 보기 URL은 토큰이 포함되어 있어 기본 출력에서는 숨깁니다.[/dim]")
                console.print("[dim]원문 URL이 필요하면 [bold]ssafer guest --show-url[/bold]을 실행하세요.[/dim]")
        _print_guest_web_hint(effective_endpoint)
        _prompt_start_agent_after_login()
        return

    email = typer.prompt("이메일")
    password = typer.prompt("비밀번호", hide_input=True)
    if not email.strip() or not password.strip():
        console.print("[red]이메일과 비밀번호를 모두 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        auth_data = login_with_credentials(effective_endpoint, email.strip(), password)
        save_auth_tokens(auth_data, effective_endpoint)
        _clear_agent_config_if_auth_changed(previous_auth_mode, previous_auth_subject)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]로그인 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]로그인 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    except ValueError as exc:
        console.print(f"[red]로그인 실패:[/red] {exc}")
        raise typer.Exit(code=1) from exc
    console.print("[green]로그인 완료. 토큰은 ~/.ssafer/config.yml에 저장됩니다.[/green]")
    console.print(f"웹 대시보드: {_web_url(effective_endpoint, '/dashboard')}")
    console.print("[dim]브라우저 로그인이 필요할 수 있습니다. CLI 로그인 토큰은 터미널 업로드/agent 연결에만 사용됩니다.[/dim]")
    _prompt_start_agent_after_login()


def _clear_agent_config_if_auth_changed(previous_mode: str | None, previous_subject: str | None) -> None:
    from ssafer.core.auth import clear_agent_config, load_auth_identity

    current_mode, current_subject = load_auth_identity()
    if not previous_mode and not previous_subject:
        return
    if previous_mode and current_mode and previous_mode != current_mode:
        clear_agent_config(Path("."))
        return
    if previous_subject and current_subject and previous_subject != current_subject:
        clear_agent_config(Path("."))


def _prompt_start_agent_after_login() -> None:
    console.print(
        "[dim]웹에서 이 PC/서버에 스캔이나 수정 적용을 요청하려면 Local Agent가 실행 중이어야 합니다.[/dim]"
    )
    if typer.confirm("지금 Local Agent를 시작할까요?", default=False):
        _start_agent(path=Path("."), refresh_token=True)
        return
    console.print("[dim]Agent는 시작하지 않았습니다. 나중에 연결하려면 [bold]ssafer agent[/bold]를 실행하세요.[/dim]")


@app.command("guest", help="이메일 없이 게스트 토큰을 발급받아 CLI를 바로 사용합니다.", rich_help_panel="계정/상태")
def guest(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="게스트 토큰을 발급받을 SSAfer 백엔드 API URL입니다."),
    show_url: bool = typer.Option(False, "--show-url", help="웹에서 이어보기 URL의 토큰 원문을 출력합니다."),
) -> None:
    """게스트 모드로 CLI를 시작합니다."""
    from ssafer.core.auth import load_auth_mode, load_endpoint, load_token

    effective_endpoint = endpoint or load_endpoint()
    current_token = load_token()
    if load_auth_mode() == "guest" and current_token:
        console.print("[green]저장된 게스트 세션을 사용합니다.[/green]")
        console.print(
            "[dim]\uc774 URL\uc740 \uc800\uc7a5\ub41c \uac8c\uc2a4\ud2b8 \uc138\uc158\uc744 \uadf8\ub300\ub85c \uc774\uc5b4\uc11c \uc5fd\ub2c8\ub2e4. "
            "\uae30\uc874 \ud504\ub85c\uc81d\ud2b8/\uc2a4\uce94 \uc774\ub825\ub3c4 \uac19\uc774 \ubcf4\uc785\ub2c8\ub2e4. "
            "\uc0c8 \ube48 \uac8c\uc2a4\ud2b8 \uc138\uc158\uc774 \ud544\uc694\ud558\uba74 [bold]ssafer logout[/bold] \ud6c4 \ub2e4\uc2dc \uc2e4\ud589\ud558\uc138\uc694.[/dim]"
        )
        if show_url:
            continue_url = _guest_continue_url(effective_endpoint, current_token)
            console.print(f"웹에서 이어 보기: [link={escape(continue_url)}]{escape(continue_url)}[/link]")
            console.print("[yellow]URL에 게스트 토큰이 포함되어 있습니다. 다른 사람에게 공유하지 마세요.[/yellow]")
        else:
            console.print("[dim]웹에서 이어 보기 URL은 토큰이 포함되어 있어 기본 출력에서는 숨깁니다.[/dim]")
            console.print("[dim]원문 URL이 필요하면 [bold]ssafer guest --show-url[/bold]을 실행하세요.[/dim]")
        _print_guest_web_hint(effective_endpoint)
        _prompt_start_agent_after_login()
        return
    login(endpoint=endpoint, logout=False, guest=True, guest_token=None, show_url=show_url)


@app.command(help="이메일 인증을 거쳐 새 SSAfer 계정을 만듭니다.", rich_help_panel="계정/상태")
def signup(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="회원가입에 사용할 SSAfer 백엔드 API URL입니다."),
) -> None:
    """이메일 인증 후 SSAfer 계정을 생성합니다."""
    from ssafer.core.auth import (
        load_auth_identity,
        load_endpoint,
        login_with_credentials,
        register_user,
        save_auth_tokens,
        send_email_verification_code,
        verify_email_code,
    )

    effective_endpoint = endpoint or load_endpoint()
    console.print("[cyan]SSAfer 계정을 만듭니다. 이메일 인증을 마친 뒤 회원가입을 진행합니다.[/cyan]")
    email = _prompt_signup_email()
    display_name = typer.prompt("표시 이름")
    password = typer.prompt("비밀번호", hide_input=True)
    if not display_name.strip() or not password.strip():
        console.print("[red]표시 이름과 비밀번호는 비워둘 수 없습니다.[/red]")
        raise typer.Exit(code=1)

    try:
        email = _verify_signup_email_code(
            effective_endpoint,
            email,
            send_email_verification_code,
            verify_email_code,
        )
        console.print("[cyan]회원가입을 요청합니다...[/cyan]")
        register_user(effective_endpoint, email, display_name.strip(), password)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]회원가입 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]회원가입 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc

    console.print("[green]회원가입이 완료되었습니다.[/green]")
    if not typer.confirm("가입한 계정으로 바로 로그인할까요?", default=False):
        console.print("[dim]나중에 로그인하려면 [bold]ssafer login[/bold]을 실행하세요.[/dim]")
        return

    previous_auth_mode, previous_auth_subject = load_auth_identity()
    try:
        auth_data = login_with_credentials(effective_endpoint, email, password)
        save_auth_tokens(auth_data, effective_endpoint)
        _clear_agent_config_if_auth_changed(previous_auth_mode, previous_auth_subject)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]로그인 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]로그인 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    except ValueError as exc:
        console.print(f"[red]로그인 실패:[/red] {exc}")
        raise typer.Exit(code=1) from exc

    console.print("[green]로그인 완료. 토큰은 ~/.ssafer/config.yml에 저장됩니다.[/green]")
    console.print(f"웹 대시보드: {_web_url(effective_endpoint, '/dashboard')}")
    _prompt_start_agent_after_login()


def _prompt_signup_email() -> str:
    while True:
        email = typer.prompt("이메일").strip()
        if not email:
            console.print("[red]이메일은 비워둘 수 없습니다.[/red]")
            continue
        if _is_valid_email(email):
            return email
        console.print("[red]이메일 형식이 올바르지 않습니다. 예: user@example.com[/red]")


def _is_valid_email(email: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()))


def _verify_signup_email_code(
    endpoint: str,
    email: str,
    send_code: Callable[[str, str], object],
    verify_code: Callable[[str, str, str], object],
) -> str:
    while True:
        console.print("[cyan]이메일 인증 코드를 발송합니다...[/cyan]")
        send_code(endpoint, email)
        console.print("[green]인증 코드를 보냈습니다. 이메일함에서 코드를 확인해 주세요.[/green]")
        for attempt in range(1, 4):
            code = typer.prompt("인증 코드").strip()
            if not code:
                console.print("[red]인증 코드는 비워둘 수 없습니다.[/red]")
            else:
                try:
                    console.print("[cyan]인증 코드를 확인합니다...[/cyan]")
                    verify_code(endpoint, email, code)
                    return email
                except httpx.HTTPStatusError:
                    if attempt >= 3:
                        raise
                    console.print(f"[yellow]인증 코드가 올바르지 않습니다. 남은 횟수: {3 - attempt}[/yellow]")
                    if typer.confirm("인증 코드를 다시 발송할까요?", default=False):
                        break
                    if typer.confirm("이메일을 다시 입력할까요?", default=False):
                        email = _prompt_signup_email()
                        break
                    continue
            if attempt >= 3:
                console.print("[red]인증 코드 입력 가능 횟수를 초과했습니다. 다시 signup을 실행해 주세요.[/red]")
                raise typer.Exit(code=1)
        else:
            raise typer.Exit(code=1)

@app.command("send-email-code", hidden=True)
def send_email_code(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer backend API URL"),
) -> None:
    """Send an email verification code for SSAfer signup."""
    from ssafer.core.auth import load_endpoint, send_email_verification_code

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("이메일")
    if not email.strip():
        console.print("[red]이메일을 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        send_email_verification_code(effective_endpoint, email.strip())
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]이메일 인증 코드 발송 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]이메일 인증 코드 발송 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    console.print("[green]인증 코드를 보냈습니다. 이메일함을 확인하세요.[/green]")


@app.command("verify-email", hidden=True)
def verify_email(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="SSAfer backend API URL"),
) -> None:
    """Verify the email code before SSAfer signup."""
    from ssafer.core.auth import load_endpoint, verify_email_code

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("이메일")
    code = typer.prompt("인증 코드")
    if not email.strip() or not code.strip():
        console.print("[red]이메일과 인증 코드를 모두 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        verify_email_code(effective_endpoint, email.strip(), code.strip())
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]이메일 인증 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]이메일 인증 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    console.print("[green]이메일 인증이 완료되었습니다. 회원가입은 ssafer signup에서 이어서 진행할 수 있습니다.[/green]")


@app.command(help="저장된 로그인/Agent 정보를 삭제하고 CLI 연결을 해제합니다.", rich_help_panel="계정/상태")
def logout() -> None:
    """저장된 로그인 토큰과 현재 프로젝트의 agent 설정을 삭제합니다."""
    from ssafer.core.auth import clear_agent_config, clear_token

    clear_token()
    clear_agent_config(Path("."))
    console.print("[green]저장된 SSAfer 로그인 정보와 현재 프로젝트의 Local Agent 설정을 삭제했습니다.[/green]")
    console.print("[dim]다른 터미널에서 Local Agent가 실행 중이면 Ctrl+C로 종료하세요.[/dim]")


@app.command(help="현재 로그인한 회원 계정을 탈퇴하고 로컬 로그인 정보를 삭제합니다.", rich_help_panel="계정/상태")
def withdraw(
    yes: bool = typer.Option(False, "--yes", "-y", help="확인 질문 없이 회원탈퇴를 진행합니다."),
) -> None:
    """현재 로그인한 회원 계정을 탈퇴합니다. 게스트 토큰으로는 사용할 수 없습니다."""
    from ssafer.core.auth import clear_agent_config, clear_token, load_endpoint, load_token, withdraw_current_user

    token = load_token()
    if not token:
        console.print("[red]회원탈퇴를 진행하려면 먼저 ssafer login으로 로그인해야 합니다.[/red]")
        raise typer.Exit(code=1)

    if not yes:
        confirmed = typer.confirm("정말 SSAfer 회원 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.", default=False)
        if not confirmed:
            console.print("[yellow]회원탈퇴를 취소했습니다.[/yellow]")
            return

    endpoint = load_endpoint()
    try:
        withdraw_current_user(endpoint, token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]회원탈퇴 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]회원탈퇴 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc

    clear_token()
    clear_agent_config(Path("."))
    console.print("[green]회원탈퇴가 완료되었습니다. 저장된 로그인 정보와 현재 프로젝트의 Local Agent 설정을 삭제했습니다.[/green]")


@app.command(help="최근 로컬 스캔 결과를 터미널에서 확인합니다.", rich_help_panel="로컬 점검")
def report(
    path: Path = typer.Option(Path("."), "--path", "-p", help=".ssafer/results가 있는 프로젝트 루트입니다."),
    details: bool = typer.Option(False, "--details", "-d", help="스캔 대상, 산출물 경로, finding 상세를 함께 출력합니다."),
) -> None:
    """최근 로컬 스캔 결과 요약을 출력합니다."""
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


def _format_http_transport_error(exc: httpx.HTTPError) -> str:
    message = _mask_non_api_urls(str(exc))
    request = getattr(exc, "request", None)
    if request is not None:
        return f"{message} (request: {_format_upload_request_url(request.url)})"
    return message


def _mask_non_api_urls(text: str) -> str:
    return re.sub(r"https?://[^\s'\")>]+", lambda match: _format_upload_request_url(match.group(0)), text)


def _format_upload_request_url(url: object) -> str:
    text = str(url)
    if "/api/" in text:
        return text
    return "S3 presigned upload URL hidden"


def _scan_has_targets(scan: dict) -> bool:
    summary = scan.get("cliSummary", {})
    target_counts = [summary.get(key) for key in ("composeSets", "envFiles", "dockerfiles")]
    if any(value is not None for value in target_counts):
        return any(int(value or 0) > 0 for value in target_counts)

    targets = scan.get("targets", {})
    if isinstance(targets, dict) and any(key in targets for key in ("composeSets", "envFiles", "dockerfiles")):
        return any(len(targets.get(key) or []) > 0 for key in ("composeSets", "envFiles", "dockerfiles"))

    return bool(scan.get("findings") or scan.get("artifacts"))


def _scan_status_label(scan: dict) -> str:
    status = scan.get("analysisStatus", "UNKNOWN")
    if status == "FAILED" and not _scan_has_targets(scan):
        return _SCAN_EMPTY_STATUS
    return _STATUS_KO.get(status, status)


def _print_scan_target_hint(scan: dict) -> None:
    if _scan_has_targets(scan):
        return
    console.print("[yellow]스캔 대상 파일을 찾지 못했습니다.[/yellow]")
    console.print(
        "[dim]현재 폴더에 .env, Dockerfile, docker-compose.yml 같은 점검 대상이 없습니다. "
        "프로젝트 루트에서 실행하거나 --path로 대상 경로를 지정하세요.[/dim]"
    )
    console.print("[dim]예: ssafer run --path ..[/dim]")


def _print_scan_summary(scan: dict) -> None:
    summary = scan.get("cliSummary", {})
    status_label = _scan_status_label(scan)
    local_scan_id = scan.get("scanId", "unknown")

    console.print(f"[cyan]로컬 스캔 ID:[/cyan] {local_scan_id}")
    console.print("[dim]웹에서 쓰는 백엔드 scanId는 upload 후 별도로 발급됩니다.[/dim]")

    table = Table(title=f"스캔 결과  {status_label}")
    table.add_column("항목")
    table.add_column("수량", justify="right")
    console.print(f"[bold]스캔 결과:[/bold] {status_label}")
    table.title = None
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
    _print_scan_target_hint(scan)

    warnings = scan.get("warnings", [])
    if warnings:
        _print_scan_warnings(warnings, scan)


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
        console.print(Panel.fit("발견된 보안 항목이 없습니다.", title="Findings"))
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
    file_path = _finding_display_path(finding)
    line = finding.get("line")
    return f"{file_path}:{line}" if line else file_path


def _finding_display_path(finding: dict) -> str:
    file_path = finding.get("filePath")
    if isinstance(file_path, str) and file_path.strip():
        return file_path
    target_files = finding.get("targetFiles")
    if isinstance(target_files, list):
        paths = [str(item) for item in target_files if item]
        if paths:
            return _join_compact(paths, max_items=3)
    return str(finding.get("file") or "-")


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


def _print_scan_warnings(warnings: list[object], scan: dict | None = None) -> None:
    table = Table(title="경고 목록", show_lines=True)
    table.add_column("번호", justify="right", no_wrap=True)
    table.add_column("분류", no_wrap=True)
    table.add_column("대상", overflow="fold")
    table.add_column("내용", overflow="fold")
    fallback_targets = iter(_compose_warning_fallback_targets(scan or {}))
    for index, warning in enumerate(warnings, start=1):
        category, target, message = _format_scan_warning_row(warning)
        if target == "Compose 설정" and category.startswith("Compose"):
            target = next(fallback_targets, target)
        table.add_row(str(index), category, target, message)
    console.print(table)


def _compose_warning_fallback_targets(scan: dict) -> list[str]:
    targets = scan.get("targets", {})
    compose_sets = targets.get("composeSets", []) if isinstance(targets, dict) else []
    result: list[str] = []
    for compose_set in compose_sets:
        if not isinstance(compose_set, dict):
            continue
        name = str(compose_set.get("name") or "compose")
        files = [_format_warning_path(item) for item in compose_set.get("files", []) if item]
        if not files:
            continue
        result.append(f"{name}: {_join_compact(files, max_items=2)}")
    return result


def _format_scan_warning_row(warning: object) -> tuple[str, str, str]:
    text = str(warning).replace("\r\n", "\n").strip()
    if not text:
        return ("기타", "-", "-")

    compose_context = _extract_compose_warning_context(text)
    if compose_context:
        text = compose_context["message"]

    standalone_compose_match = re.search(r"(.+?)을 함께 쓸 기본 Compose 파일 없이 단독으로 분석했습니다\.", text)
    standalone_compose_metadata_match = re.search(r"기본 Compose 파일 없이 단독으로 분석했습니다\.", text)
    if standalone_compose_match or standalone_compose_metadata_match:
        target = compose_context["target"] if compose_context else _format_warning_path(standalone_compose_match.group(1))
        return (
            "Compose 파일",
            target,
            "이 compose 파일만 단독으로 분석했습니다. 같은 폴더에 docker-compose.yml이 있으면 함께 분석됩니다.",
        )

    missing_vars = list(dict.fromkeys(re.findall(r'The \\?"([^"\\]+)\\?" variable is not set', text)))
    if missing_vars:
        return (
            "Compose 환경변수",
            compose_context["target"] if compose_context else "Compose 설정",
            f"필요한 환경변수가 비어 있습니다: {_join_compact(missing_vars, max_items=5)}",
        )

    env_file_match = re.search(r"env file (.+?) not found", text)
    if env_file_match:
        return ("Compose env 파일", env_file_match.group(1), "Compose가 참조하는 env 파일을 찾지 못했습니다.")

    service_match = re.search(r'service "([^"]+)" has neither an image nor a build context specified', text)
    if service_match:
        return (
            "Compose 서비스",
            service_match.group(1),
            "image 또는 build 설정이 없어 해당 서비스를 분석하지 못했습니다.",
        )

    return ("기타", "-", _format_report_evidence(text))


def _extract_compose_warning_context(text: str) -> dict[str, str] | None:
    match = re.match(r"^\[ssafer-compose name=([^\] ]+) files=([^\]]*)\]\s*(.*)$", text, flags=re.DOTALL)
    if not match:
        return None
    name = match.group(1)
    files = [item.strip() for item in match.group(2).split(",") if item.strip()]
    target_files = _join_compact([_format_warning_path(item) for item in files], max_items=2) if files else "Compose 설정"
    return {
        "name": name,
        "files": ", ".join(files),
        "target": f"{name}: {target_files}",
        "message": match.group(3).strip(),
    }


def _format_warning_path(path: object) -> str:
    text = str(path)
    try:
        parsed = Path(text)
        if parsed.is_absolute():
            cwd = Path.cwd()
            for base in (cwd, *cwd.parents):
                try:
                    return str(parsed.relative_to(base))
                except ValueError:
                    continue
            return parsed.name
        return text
    except (OSError, ValueError):
        return text


def _format_scan_warning(warning: object) -> str:
    category, target, message = _format_scan_warning_row(warning)
    return f"{category} - {target}: {message}" if target != "-" else f"{category}: {message}"


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
    scan_id = response.get("scanId")
    if scan_id is not None:
        console.print(f"스캔 ID: {scan_id}")
    else:
        console.print("[yellow]스캔 ID: 백엔드 응답에 포함되지 않음[/yellow]")
        console.print("[dim]업로드는 완료됐지만, 웹에서 결과를 찾기 어렵다면 최근 스캔 목록을 확인해 주세요.[/dim]")
    if response.get("status"):
        console.print(f"상태: {response['status']}")
    if response.get("viewUrl"):
        console.print(f"결과 보기: {response['viewUrl']}")
    elif scan_id is not None:
        status = str(response.get("status") or "").upper()
        if status == "DONE":
            console.print(f"결과 보기: {_web_url(response.get('_apiUrl'), f'/results/{scan_id}')}")
        else:
            console.print(f"진행 상황 보기: {_web_url(response.get('_apiUrl'), f'/scans/{scan_id}')}")
    else:
        console.print("[dim]AI 분석이 끝나면 웹의 스캔 결과 화면에서 확인할 수 있습니다.[/dim]")


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


def _download_analysis_result_or_exit(project_root: Path, *, scan_id: int, api_url: str | None) -> Path:
    from ssafer.core.analysis_result import download_analysis_result_for_scan
    from ssafer.core.auth import load_endpoint, load_token
    from ssafer.core.config import load_project_config

    config_warnings: list[str] = []
    project_config = load_project_config(project_root, config_warnings)
    for warning in config_warnings:
        console.print(f"[yellow]{warning}[/yellow]")

    token = load_token(project_config.upload.token_env)
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    if token is None:
        console.print(
            "[yellow]analysis_result 다운로드에는 로그인이 필요합니다. 먼저 [bold]ssafer login[/bold]을 실행하거나 "
            "SSAFER_TOKEN을 설정하세요.[/yellow]"
        )
        raise typer.Exit(code=1)

    try:
        console.print(f"[cyan]scanId={scan_id}의 analysis_result.json을 내려받습니다...[/cyan]")
        return download_analysis_result_for_scan(project_root, scan_id=scan_id, api_url=effective_url, token=token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]analysis_result 다운로드 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]analysis_result 다운로드 실패:[/red] {_format_http_transport_error(exc)}")
    except (OSError, ValueError, RuntimeError) as exc:
        console.print(f"[red]analysis_result 다운로드 실패:[/red] {exc}")
    raise typer.Exit(code=1)


def _latest_done_scan_id_or_exit(project_root: Path, *, project_id: int | None, api_url: str | None) -> int:
    from ssafer.core.analysis_result import find_latest_done_scan_id
    from ssafer.core.auth import load_agent_config, load_endpoint, load_token
    from ssafer.core.config import load_project_config

    config_warnings: list[str] = []
    project_config = load_project_config(project_root, config_warnings)
    for warning in config_warnings:
        console.print(f"[yellow]{warning}[/yellow]")

    token = load_token(project_config.upload.token_env)
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    if token is None:
        console.print(
            "[yellow]최신 스캔 조회에는 로그인이 필요합니다. 먼저 [bold]ssafer login[/bold]을 실행하거나 "
            "SSAFER_TOKEN을 설정하세요.[/yellow]"
        )
        raise typer.Exit(code=1)

    effective_project_id = project_id
    if effective_project_id is None:
        agent_config = load_agent_config(project_root)
        saved_project_id = agent_config.get("projectId")
        if saved_project_id is not None:
            try:
                effective_project_id = int(saved_project_id)
            except (TypeError, ValueError):
                effective_project_id = None
    if effective_project_id is None:
        effective_project_id = _select_agent_project_id(effective_url, token)

    try:
        scan_id = find_latest_done_scan_id(effective_url, project_id=effective_project_id, token=token)
        console.print(f"[cyan]최신 완료 스캔을 사용합니다.[/cyan] projectId={effective_project_id}, scanId={scan_id}")
        return scan_id
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]최신 스캔 조회 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]최신 스캔 조회 실패:[/red] {_format_http_transport_error(exc)}")
    except (ValueError, RuntimeError) as exc:
        message = str(exc)
        if message == f"projectId={effective_project_id}에 완료된 스캔이 없습니다.":
            message = (
                f"projectId={effective_project_id}에 완료된 스캔이 없습니다. "
                "먼저 ssafer run --upload 또는 ssafer upload로 분석이 완료된 스캔을 만든 뒤 다시 실행하세요."
            )
        console.print(f"[red]최신 스캔 조회 실패:[/red] {message}")
    raise typer.Exit(code=1)


def _wait_for_uploaded_scan(
    project_root: Path,
    *,
    response: dict,
    api_url: str | None,
    timeout_seconds: int = 300,
    interval_seconds: int = 3,
    max_status_failures: int = 5,
) -> dict:
    scan_id = response.get("scanId")
    if scan_id is None:
        return response

    from ssafer.core.auth import load_endpoint, load_token, normalize_api_url
    from ssafer.core.config import load_project_config

    project_config = load_project_config(project_root, [])
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    base_url = normalize_api_url(effective_url)
    token = load_token(project_config.upload.token_env)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    progress_url = _web_url(base_url, f"/scans/{scan_id}")

    console.print(f"진행 상황 보기: {progress_url}")
    deadline = time.monotonic() + timeout_seconds
    latest = dict(response)
    latest["_apiUrl"] = base_url
    status_failures = 0

    with console.status("[cyan]AI 분석 완료를 기다리는 중...[/cyan]", spinner="dots") as status:
        while time.monotonic() < deadline:
            try:
                status_data = _fetch_scan_status(base_url, scan_id, headers)
                status_failures = 0
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if status_code in {401, 403}:
                    console.print(f"[red]AI 분석 상태 조회 실패:[/red] {_format_http_error(exc)}")
                    console.print(f"[dim]웹에서 계속 확인하세요: {progress_url}[/dim]")
                    raise typer.Exit(code=1) from exc
                if status_code not in {408, 429, 500, 502, 503, 504}:
                    console.print(f"[red]AI 분석 상태 조회 실패:[/red] {_format_http_error(exc)}")
                    console.print(f"[dim]웹에서 계속 확인하세요: {progress_url}[/dim]")
                    raise typer.Exit(code=1) from exc
                status_failures += 1
                if status_failures >= max_status_failures:
                    console.print(f"[yellow]AI 분석 상태 조회가 일시적으로 실패했습니다.[/yellow] {_format_http_error(exc)}")
                    console.print(f"[dim]웹에서 계속 확인하세요: {progress_url}[/dim]")
                    return latest
                status.update(
                    f"[yellow]AI 분석 상태 조회 재시도 중... "
                    f"{status_code} ({status_failures}/{max_status_failures})[/yellow]"
                )
                time.sleep(interval_seconds)
                continue
            except httpx.HTTPError as exc:
                status_failures += 1
                if status_failures >= max_status_failures:
                    console.print(f"[yellow]AI 분석 상태 조회가 일시적으로 실패했습니다.[/yellow] {_format_http_transport_error(exc)}")
                    console.print(f"[dim]웹에서 계속 확인하세요: {progress_url}[/dim]")
                    return latest
                status.update(
                    f"[yellow]AI 분석 상태 조회 재시도 중... "
                    f"네트워크 오류 ({status_failures}/{max_status_failures})[/yellow]"
                )
                time.sleep(interval_seconds)
                continue
            latest.update(status_data)
            latest.setdefault("scanId", scan_id)
            latest["_apiUrl"] = base_url
            current_status = str(status_data.get("status") or latest.get("status") or "UNKNOWN").upper()
            progress_step = status_data.get("progressStep") or "-"
            status.update(f"[cyan]AI 분석 진행 중... 상태={current_status}, 단계={progress_step}[/cyan]")
            if current_status == "DONE":
                return latest
            if current_status in {"FAILED", "CANCELED"}:
                console.print(f"[red]AI 분석이 완료되지 못했습니다.[/red] 상태={current_status}")
                if status_data.get("errorMessage"):
                    console.print(f"[yellow]{status_data['errorMessage']}[/yellow]")
                raise typer.Exit(code=1)
            time.sleep(interval_seconds)

    console.print("[yellow]AI 분석 완료 대기 시간이 초과되었습니다.[/yellow]")
    console.print(f"[dim]웹에서 계속 확인하세요: {progress_url}[/dim]")
    return latest


def _fetch_scan_status(base_url: str, scan_id: object, headers: dict[str, str]) -> dict:
    with httpx.Client(timeout=10) as client:
        response = client.get(f"{base_url}/api/v1/scans/{scan_id}/status", headers=headers)
        response.raise_for_status()
        payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _web_url(api_url: object, path: str) -> str:
    from ssafer.core.auth import DEFAULT_API_URL, normalize_api_url

    base_url = normalize_api_url(str(api_url or DEFAULT_API_URL))
    return f"{base_url}{path}"


def _web_project_url(api_url: object, project_id: object) -> str:
    return _web_url(api_url, f"/projects/{project_id}")


def _print_project_web_link(api_url: object, project_id: object) -> None:
    console.print(f"웹 프로젝트: {_web_project_url(api_url, project_id)}")


def _print_guest_web_hint(api_url: object) -> None:
    console.print(f"웹 대시보드: {_web_url(api_url, '/dashboard')}")
    console.print("[dim]웹에서 만든 프로젝트 요청을 이 PC/서버가 처리하려면 프로젝트 폴더에서 [bold]ssafer agent[/bold]를 실행하세요.[/dim]")


def _apply_web_scan_url(project_root: Path, api_url: str | None, scan_id: int) -> str:
    from ssafer.core.auth import load_endpoint
    from ssafer.core.config import load_project_config

    project_config = load_project_config(project_root, [])
    effective_url = api_url or project_config.upload.endpoint or load_endpoint()
    return _web_url(effective_url, f"/scans/{scan_id}")


def _guest_continue_url(api_url: object, guest_token: str) -> str:
    return f"{_web_url(api_url, '/guest/continue')}?{urlencode({'token': guest_token})}"


def _mask_guest_continue_url(url: str) -> str:
    return re.sub(r"([?&]token=)[^&]+", r"\1***MASKED***", url)


def _upload_or_exit(path: Path, api_url: str | None, on_step=None) -> dict:
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
        return upload_last_scan(path, api_url=effective_url, token=token, on_step=on_step)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_transport_error(exc)}")
    except RuntimeError as exc:
        console.print(f"[red]업로드 실패:[/red] {exc}")
    raise typer.Exit(code=1)


def _upload_server_audit_or_exit(path: Path, api_url: str | None, on_step=None) -> dict:
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
            "[yellow]\uc11c\ubc84 \uc810\uac80 \uacb0\uacfc\ub97c \uc5c5\ub85c\ub4dc\ud558\ub824\uba74 \ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4. "
            "\uba3c\uc800 [bold]ssafer login[/bold]\uc744 \uc2e4\ud589\ud558\uc138\uc694.\n"
            "  \uac8c\uc2a4\ud2b8 \uc138\uc158\uc744 \uc0ac\uc6a9\ud55c\ub2e4\uba74 [bold]ssafer login --guest-token <token>[/bold]\uc744 \uc2e4\ud589\ud558\uc138\uc694.\n"
            "  \ub610\ub294 \ud658\uacbd\ubcc0\uc218 SSAFER_TOKEN\uc744 \uc124\uc815\ud558\uc138\uc694.[/yellow]"
        )
        raise typer.Exit(code=1)
    try:
        return upload_last_server_audit(path, api_url=effective_url, token=token, on_step=on_step)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_transport_error(exc)}")
    except RuntimeError as exc:
        console.print(f"[red]업로드 실패:[/red] {exc}")
    raise typer.Exit(code=1)


@app.command("guest-login", hidden=True)
def guest_login(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="게스트 토큰을 발급받을 SSAfer 백엔드 API URL입니다."),
    show_url: bool = typer.Option(False, "--show-url", help="웹에서 이어보기 URL의 토큰 원문을 출력합니다."),
) -> None:
    """Backward-compatible alias for ssafer guest."""
    guest(endpoint=endpoint, show_url=show_url)


@app.command("scan", hidden=True)
def scan(
    path: Path = typer.Option(Path("."), "--path", "-p", help="스캔할 프로젝트 루트입니다."),
    upload: bool = typer.Option(False, "--upload", help="스캔 후 결과를 웹으로 업로드합니다."),
    save_raw: bool = typer.Option(False, "--save-raw", help="마스킹 전 effective compose 설정도 로컬에 저장합니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="업로드에 사용할 SSAfer 백엔드 API URL입니다."),
    env: Optional[str] = typer.Option(None, "--env", "-e", help="환경 (local/production). 생략 시 자동 감지합니다."),
) -> None:
    """Short alias for ssafer run."""
    run(path=path, upload=upload, save_raw=save_raw, api_url=api_url, env=env)


@app.command("fix", hidden=True)
def fix(
    path: Path = typer.Option(Path("."), "--path", "-p", help="수정안을 적용할 프로젝트 루트입니다."),
    scan_id: Optional[int] = typer.Option(None, "--scan-id", help="해당 백엔드 scanId의 analysis_result.json을 내려받아 적용합니다."),
    latest: bool = typer.Option(False, "--latest", help="선택한 프로젝트의 최신 DONE 스캔 결과를 내려받아 적용합니다."),
    project_id: Optional[int] = typer.Option(None, "--project-id", help="--latest에서 사용할 프로젝트 ID입니다."),
    dry_run: bool = typer.Option(False, "--dry-run", help="파일을 바꾸지 않고 적용 가능 여부만 확인합니다."),
) -> None:
    """Short alias for the common ssafer apply flow."""
    apply_fix(
        scan_id_arg=None,
        path=path,
        analysis_result=None,
        scan_id=scan_id,
        latest=latest,
        project_id=project_id,
        api_url=None,
        patch_id=None,
        dry_run=dry_run,
        yes=False,
    )


@app.command("server", help="현재 서버 런타임 보안 상태를 점검합니다.", rich_help_panel="서버 점검")
def server(
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="server-audit 결과를 저장할 기준 폴더입니다."),
    upload: bool = typer.Option(False, "--upload", help="점검 결과를 생성한 뒤 백엔드/S3에 업로드합니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="업로드에 사용할 SSAfer 백엔드 API URL입니다."),
    details: bool = typer.Option(False, "--details", "-d", help="findings, warnings, artifacts 상세 내용을 함께 출력합니다."),
    include_os_packages: bool = typer.Option(False, "--include-os-packages", help="OS 패키지 취약점까지 점검합니다."),
    allow_sudo: bool = typer.Option(False, "--allow-sudo", help="권한이 필요한 서버 점검을 사용자 확인 없이 sudo로 재시도합니다."),
) -> None:
    """Short alias for the common ssafer server-audit flow."""
    server_audit(
        path=path,
        upload=upload,
        api_url=api_url,
        checks=None,
        details=details,
        include_os_packages=include_os_packages,
        allow_sudo_option=allow_sudo,
    )


@app.command("tools", help="로컬/서버 스캔에 필요한 도구를 설치합니다.", rich_help_panel="기본")
def tools() -> None:
    """Short alias for ssafer install-tools."""
    install_tools()


@app.command("last", hidden=True)
def last(
    path: Path = typer.Option(Path("."), "--path", "-p", help=".ssafer/results가 있는 프로젝트 루트입니다."),
    details: bool = typer.Option(False, "--details", "-d", help="스캔 대상, 산출물 경로, finding 상세를 함께 출력합니다."),
) -> None:
    """Short alias for ssafer report."""
    report(path=path, details=details)


def _sort_help_commands() -> None:
    preferred_order = [
        "version",
        "status",
        "signup",
        "login",
        "logout",
        "guest",
        "withdraw",
        "tools",
        "server-audit",
        "server",
        "run",
        "upload",
        "report",
        "apply",
        "agent",
    ]
    order = {name: index for index, name in enumerate(preferred_order)}

    def sort_key(command: typer.models.CommandInfo) -> tuple[int, str]:
        name = command.name or getattr(command.callback, "__name__", "")
        return (order.get(name, len(order)), name)

    app.registered_commands.sort(key=sort_key)


_sort_help_commands()


if __name__ == "__main__":
    app()
