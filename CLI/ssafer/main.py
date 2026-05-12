from __future__ import annotations

import asyncio
import difflib
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

app = typer.Typer(help="SSAfer 보안 점검 CLI.")
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


@app.command(help="CLI 버전을 출력합니다.", rich_help_panel="기본")
def version() -> None:
    """CLI 버전을 출력합니다."""
    console.print(__version__)


@app.command(help="로그인/Agent 설정 상태를 확인합니다.", rich_help_panel="계정/상태")
def status() -> None:
    """로그인과 Local Agent 설정 상태를 확인합니다."""
    from ssafer.core.auth import (
        CONFIG_PATH,
        describe_token_source,
        load_agent_config,
        load_endpoint,
        load_token,
        project_agent_config_path,
    )

    token = load_token()
    token_source = describe_token_source()
    endpoint = load_endpoint()
    agent_config = load_agent_config(Path("."))
    agent_config_path = project_agent_config_path(Path("."))

    table = Table(title="SSAfer 상태")
    table.add_column("항목")
    table.add_column("상태")
    table.add_column("설명", overflow="fold")
    table.add_row("로그인", "[green]됨[/green]" if token else "[red]안 됨[/red]", "저장된 access token 기준")
    table.add_row("토큰 출처", token_source, "환경변수 토큰이 저장된 로그인 토큰보다 우선됩니다")
    table.add_row("Endpoint", endpoint, "현재 사용할 백엔드 API")
    if _has_saved_agent_config(agent_config):
        table.add_row(
            "Local Agent",
            "[green]설정됨[/green]",
            (
                f"agentId={agent_config.get('agentId')}, projectId={agent_config.get('projectId')}\n"
                f"설정 파일: {agent_config_path}"
            ),
        )
    else:
        table.add_row("Local Agent", "[yellow]미설정[/yellow]", "ssafer agent 실행 시 설정 가능")
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


@app.command("install-tools", help="Trivy 등 선택 도구를 설치합니다.", rich_help_panel="서버 점검")
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


@app.command("server-audit", help="서버 내부 런타임 보안 상태를 점검합니다.", rich_help_panel="서버 점검")
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
        console.print("[cyan]서버 점검 결과를 업로드합니다...[/cyan]")
        with console.status("[cyan]백엔드 등록 및 S3 업로드 진행 중...[/cyan]", spinner="dots"):
            response = _upload_server_audit_or_exit(output_root, api_url=api_url)
        _print_upload_response(response)
    console.print(f"[green]서버 점검 결과 저장:[/green] {output_path}")


def _can_prompt_for_sudo() -> bool:
    return bool(getattr(sys.stdin, "isatty", lambda: False)())


@app.command(help="현재 프로젝트를 스캔하고 로컬 결과 JSON을 생성합니다.", rich_help_panel="로컬 점검")
def run(
    path: Path = typer.Option(Path("."), "--path", "-p", help="스캔할 프로젝트 루트입니다. CLI 폴더 안이면 보통 --path .. 를 사용합니다."),
    upload: bool = typer.Option(False, "--upload", help="스캔 후 결과 JSON을 백엔드/S3에 바로 업로드합니다."),
    save_raw: bool = typer.Option(False, "--save-raw", help="마스킹 전 effective compose 설정도 로컬에 저장합니다. 민감정보 포함 가능성이 있어 주의하세요."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="--upload에 사용할 SSAfer 백엔드 API URL입니다."),
) -> None:
    """현재 프로젝트의 설정 파일을 점검하고 로컬 결과 JSON을 생성합니다."""
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
        console.print("[cyan]스캔 결과를 업로드합니다...[/cyan]")
        with console.status("[cyan]백엔드 등록 및 S3 업로드 진행 중...[/cyan]", spinner="dots"):
            response = _upload_or_exit(path.resolve(), api_url=api_url)
        _print_upload_response(response)


@app.command(help="최근 로컬 스캔 결과를 백엔드/S3에 업로드합니다.", rich_help_panel="로컬 점검")
def upload(
    path: Path = typer.Option(Path("."), "--path", "-p", help=".ssafer/results가 있는 프로젝트 루트입니다."),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="업로드에 사용할 SSAfer 백엔드 API URL입니다."),
) -> None:
    """최근 로컬 스캔 결과 JSON을 백엔드/S3에 업로드합니다."""
    console.print("[cyan]스캔 결과를 업로드합니다...[/cyan]")
    with console.status("[cyan]백엔드 등록 및 S3 업로드 진행 중...[/cyan]", spinner="dots"):
        response = _upload_or_exit(path.resolve(), api_url=api_url)
    _print_upload_response(response)


@app.command("apply", help="승인된 수정안을 로컬 프로젝트 파일에 적용합니다.", rich_help_panel="수정 적용")
def apply_fix(
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
        find_default_analysis_result,
        load_patch_candidates_from_file,
    )

    try:
        project_root = path.resolve()
        remote_options = sum(1 for enabled in (analysis_result is not None, scan_id is not None, latest) if enabled)
        if remote_options > 1:
            raise PatchError("Use only one of --analysis-result, --scan-id, or --latest.")
        if latest:
            scan_id = _latest_done_scan_id_or_exit(project_root, project_id=project_id, api_url=api_url)
            analysis_path = _download_analysis_result_or_exit(project_root, scan_id=scan_id, api_url=api_url)
        elif scan_id is not None:
            analysis_path = _download_analysis_result_or_exit(project_root, scan_id=scan_id, api_url=api_url)
        else:
            analysis_path = analysis_result or find_default_analysis_result(project_root)
        if analysis_path is None:
            raise PatchError(
                "analysis_result.json을 찾지 못했습니다. --analysis-result로 경로를 지정하거나 "
                "--scan-id/--latest로 백엔드 분석 결과를 내려받으세요."
            )
        console.print(f"[dim]Analysis result: {analysis_path}[/dim]")
        if analysis_result is None and scan_id is None and not latest and not yes:
            console.print(
                "[yellow]로컬 analysis_result.json을 사용합니다. "
                "현재 프로젝트의 분석 결과가 맞는지 확인해 주세요.[/yellow]"
            )
            if not typer.confirm("계속 진행할까요?"):
                console.print("[yellow]수정 적용을 취소했습니다.[/yellow]")
                raise typer.Exit(code=1)

        candidates = load_patch_candidates_from_file(analysis_path)
        if not candidates:
            console.print("[yellow]이 분석 결과에는 자동 적용 가능한 patch payload가 없습니다.[/yellow]")
            console.print(
                "[dim]파일은 변경하지 않았습니다. 웹 결과나 analysis_result.json의 권장 조치를 확인해 주세요.[/dim]"
            )
            return

        selected = [candidate for candidate in candidates if patch_id is None or candidate.patch_id == patch_id]
        if not selected:
            raise PatchError(f"patchId를 찾지 못했습니다: {patch_id}")

        selected = _select_patch_candidates(selected, patch_id=patch_id, yes=yes)
        _print_patch_preview(selected)

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


@app.command("agent", help="Local Agent를 설정하고 실행합니다.", rich_help_panel="Local Agent")
def agent(
    path: Path = typer.Option(Path("."), "--path", "-p", help="agent가 연결될 프로젝트 루트입니다."),
) -> None:
    """Local Agent를 설정하고 웹 요청을 처리할 수 있게 실행합니다."""
    _start_agent(path=path)


def _start_agent(*, path: Path, refresh_token: bool = False) -> None:
    from ssafer.core.auth import load_agent_config, load_endpoint, load_token

    project_root = path.resolve()
    agent_config = load_agent_config(project_root)
    if refresh_token or not _has_saved_agent_config(agent_config):
        endpoint = load_endpoint()
        access_token = load_token()
        if access_token is None:
            console.print("[red]로그인이 필요합니다. 먼저 ssafer login을 실행하세요.[/red]")
            raise typer.Exit(code=1)
        if refresh_token:
            project_id = _select_agent_project_id(endpoint, access_token)
        else:
            project_id = _saved_agent_project_id(agent_config) or _select_agent_project_id(endpoint, access_token)
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
        verbose=False,
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


@app.command("project-create", help="SSAfer 프로젝트를 생성합니다.", rich_help_panel="계정/상태")
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


def _select_agent_project_id(endpoint: str, access_token: str) -> int:
    from ssafer.core.auth import create_project, list_projects

    try:
        projects = list_projects(endpoint, access_token)
    except httpx.HTTPStatusError as exc:
        console.print(f"[yellow]프로젝트 목록 조회 실패:[/yellow] {_format_http_error(exc)}")
        console.print("[dim]웹에서 만든 프로젝트의 ID를 알고 있다면 직접 입력할 수 있습니다.[/dim]")
        return typer.prompt("프로젝트 ID", type=int)
    except httpx.HTTPError as exc:
        console.print(f"[yellow]프로젝트 목록 조회 실패:[/yellow] {_format_http_transport_error(exc)}")
        console.print("[dim]웹에서 만든 프로젝트의 ID를 알고 있다면 직접 입력할 수 있습니다.[/dim]")
        return typer.prompt("프로젝트 ID", type=int)

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
        return int(project_id)

    console.print("[cyan]Local Agent를 연결할 프로젝트를 선택하세요.[/cyan]")
    console.print("[dim]웹에서 이 프로젝트로 보낸 스캔/수정 요청을 현재 PC 또는 서버의 agent가 처리합니다.[/dim]")
    console.print("[dim]아래 표의 선택 번호를 입력하세요. Enter를 누르면 1번을 선택합니다.[/dim]")
    project_table = Table(title="프로젝트 목록")
    project_table.add_column("선택 번호", justify="right")
    project_table.add_column("프로젝트 이름")
    project_table.add_column("projectId", justify="right")
    for index, project in enumerate(projects, start=1):
        project_id = project.get("projectId") or project.get("id")
        name = project.get("name") or "(unnamed)"
        project_table.add_row(str(index), str(name), str(project_id or "-"))
    console.print(project_table)

    while True:
        selected = typer.prompt("선택 번호", default="1", show_default=False)
        if selected.isdigit():
            index = int(selected)
            if 1 <= index <= len(projects):
                project = projects[index - 1]
                project_id = project.get("projectId") or project.get("id")
                if project_id is not None:
                    return int(project_id)
        console.print("[red]목록 왼쪽의 선택 번호를 입력해 주세요. 예: 1[/red]")


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
    from ssafer.core.auth import load_agent_config, load_endpoint

    project_root = path.resolve()
    config = agent_config if agent_config is not None else load_agent_config(project_root)
    effective_url = api_url or config.get("endpoint") or load_endpoint()
    effective_agent_id = agent_id or _load_int_config_or_env(config, "agentId", "SSAFER_AGENT_ID", "agent ID")
    effective_project_id = project_id or _load_int_config_or_env(config, "projectId", "SSAFER_PROJECT_ID", "project ID")
    effective_agent_token = agent_token or os.getenv("SSAFER_AGENT_TOKEN") or config.get("agentToken")
    if not effective_agent_token:
        console.print("[red]Agent 토큰이 없습니다. ssafer agent로 설정하거나 --agent-token을 지정하세요.[/red]")
        raise typer.Exit(code=1)

    console.print(
        f"[green]Local Agent 실행 중[/green] projectId={effective_project_id}"
    )
    console.print(f"[dim]스캔 기준 경로: {project_root}[/dim]")
    console.print("[dim]웹에서 스캔/수정 요청을 보내면 이 터미널에서 처리합니다. 종료하려면 Ctrl+C를 누르세요.[/dim]")
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
                    console.print("[dim]No pending tasks. Agent is watching.[/dim]")
                return
            task_types = ", ".join(str(getattr(task, "task_type", "UNKNOWN")) for task in tasks)
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
        if isinstance(payload, AgentTaskResult):
            _print_agent_task_result(payload)

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
    table = Table(title=f"Agent task #{result.task_id} result")
    table.add_column("Task Type")
    table.add_column("Patch ID")
    table.add_column("Status")
    table.add_column("File", overflow="fold")
    table.add_column("Message", overflow="fold")

    if not result.patch_results:
        table.add_row(result.task_type, "-", result.status, "-", result.message)
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


@app.command(help="SSAfer 서버에 로그인합니다.", rich_help_panel="계정/상태")
def login(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="로그인할 SSAfer 백엔드 API URL입니다."),
    logout: bool = typer.Option(False, "--logout", help="저장된 로그인 토큰을 삭제합니다. 가능하면 ssafer logout 사용을 권장합니다."),
) -> None:
    """SSAfer 서버에 로그인하고 토큰을 저장합니다."""
    from ssafer.core.auth import clear_token, load_endpoint, login_with_credentials, save_auth_tokens

    if logout:
        clear_token()
        console.print("[green]로그아웃 완료. 저장된 토큰이 삭제되었습니다.[/green]")
        return

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("이메일")
    password = typer.prompt("비밀번호", hide_input=True)
    if not email.strip() or not password.strip():
        console.print("[red]이메일과 비밀번호를 모두 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        auth_data = login_with_credentials(effective_endpoint, email.strip(), password)
        save_auth_tokens(auth_data, effective_endpoint)
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
    _prompt_start_agent_after_login()


def _prompt_start_agent_after_login() -> None:
    console.print(
        "[dim]웹에서 이 PC/서버에 스캔이나 수정 적용을 요청하려면 Local Agent가 실행 중이어야 합니다.[/dim]"
    )
    if typer.confirm("지금 Local Agent를 시작할까요?", default=False):
        _start_agent(path=Path("."), refresh_token=True)
        return
    console.print("[dim]Agent는 시작하지 않았습니다. 나중에 연결하려면 [bold]ssafer agent[/bold]를 실행하세요.[/dim]")


@app.command(help="이메일 인증을 거쳐 SSAfer 계정을 생성합니다.", rich_help_panel="계정/상태")
def signup(
    endpoint: Optional[str] = typer.Option(None, "--endpoint", help="회원가입에 사용할 SSAfer 백엔드 API URL입니다."),
) -> None:
    """이메일 인증을 거쳐 SSAfer 계정을 생성합니다."""
    from ssafer.core.auth import (
        load_endpoint,
        register_user,
        send_email_verification_code,
        verify_email_code,
    )

    effective_endpoint = endpoint or load_endpoint()
    email = typer.prompt("이메일")
    display_name = typer.prompt("표시 이름")
    password = typer.prompt("비밀번호", hide_input=True)
    if not email.strip() or not display_name.strip() or not password.strip():
        console.print("[red]이메일, 표시 이름, 비밀번호를 모두 입력해야 합니다.[/red]")
        raise typer.Exit(code=1)
    try:
        send_email_verification_code(effective_endpoint, email.strip())
        console.print("[green]인증 코드를 보냈습니다. 이메일함을 확인해 주세요.[/green]")
        code = typer.prompt("이메일 인증 코드")
        if not code.strip():
            console.print("[red]이메일 인증 코드를 입력해야 합니다.[/red]")
            raise typer.Exit(code=1)
        verify_email_code(effective_endpoint, email.strip(), code.strip())
        register_user(effective_endpoint, email.strip(), display_name.strip(), password)
    except httpx.HTTPStatusError as exc:
        console.print(f"[red]회원가입 실패:[/red] {_format_http_error(exc)}")
        raise typer.Exit(code=1) from exc
    except httpx.HTTPError as exc:
        console.print(f"[red]회원가입 실패:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    console.print("[green]회원가입 완료. 이제 [bold]ssafer login[/bold]으로 로그인하세요.[/green]")


@app.command("send-email-code", hidden=True)
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
        console.print(f"[red]Email code request failed:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Verification code sent. Check your email.[/green]")


@app.command("verify-email", hidden=True)
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
        console.print(f"[red]Email verification failed:[/red] {_format_http_transport_error(exc)}")
        raise typer.Exit(code=1) from exc
    console.print("[green]Email verified. Run 'ssafer signup' to create your account.[/green]")


@app.command(help="저장된 로그인 토큰을 삭제합니다.", rich_help_panel="계정/상태")
def logout() -> None:
    """저장된 로그인 토큰과 현재 프로젝트의 agent 설정을 삭제합니다."""
    from ssafer.core.auth import clear_agent_config, clear_token

    clear_token()
    clear_agent_config(Path("."))
    console.print("[green]Saved SSAfer login and local-agent config cleared.[/green]")
    console.print("[dim]If a local agent is already running in another terminal, stop it with Ctrl+C.[/dim]")


@app.command(help="최근 로컬 스캔 결과 요약을 출력합니다.", rich_help_panel="로컬 점검")
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
    return any(
        int(summary.get(key) or 0) > 0
        for key in ("composeSets", "envFiles", "dockerfiles")
    )


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
    _print_scan_target_hint(scan)

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
        agent_config = load_agent_config(Path("."))
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
        console.print(f"[red]최신 스캔 조회 실패:[/red] {exc}")
    raise typer.Exit(code=1)


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
        console.print(f"[red]업로드 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_transport_error(exc)}")
    except RuntimeError as exc:
        console.print(f"[red]업로드 실패:[/red] {exc}")
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
        console.print(f"[red]업로드 실패:[/red] {_format_http_error(exc)}")
        console.print(f"[dim]Request URL: {_format_upload_request_url(exc.request.url)}[/dim]")
    except httpx.HTTPError as exc:
        console.print(f"[red]업로드 실패:[/red] {_format_http_transport_error(exc)}")
    except RuntimeError as exc:
        console.print(f"[red]업로드 실패:[/red] {exc}")
    raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
