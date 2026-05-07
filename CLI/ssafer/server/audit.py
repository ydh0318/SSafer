from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from uuid import uuid4


SENSITIVE_PORTS = {
    22: ("SSH", "MEDIUM"),
    3306: ("MySQL", "HIGH"),
    5432: ("PostgreSQL", "HIGH"),
    5672: ("RabbitMQ", "MEDIUM"),
    6379: ("Redis", "HIGH"),
    8080: ("Application HTTP", "LOW"),
    15672: ("RabbitMQ management", "MEDIUM"),
}


@dataclass(frozen=True)
class CommandResult:
    command: list[str]
    exit_code: int
    stdout: str = ""
    stderr: str = ""


@dataclass
class ServerFinding:
    id: str
    ruleId: str
    source: str
    severity: str
    target: str
    title: str
    evidence: str


@dataclass
class ServerArtifact:
    type: str
    target: str
    content: object


@dataclass
class ServerAuditResult:
    schemaVersion: str = "0.1"
    auditId: str = field(default_factory=lambda: str(uuid4()))
    source: str = "server-audit"
    generatedAt: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    findings: list[ServerFinding] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    artifacts: list[ServerArtifact] = field(default_factory=list)


Runner = Callable[[list[str]], CommandResult]


def run_server_audit(
    *,
    checks: list[str] | None = None,
    include_os_packages: bool = False,
    allow_sudo: bool = False,
    runner: Runner | None = None,
    sshd_config: Path = Path("/etc/ssh/sshd_config"),
) -> ServerAuditResult:
    selected = set(checks or ["ports", "processes", "docker", "ssh", "firewall", "nginx", "os-packages"])
    command_runner = runner or run_command
    result = ServerAuditResult()

    if "ports" in selected:
        _audit_ports(result, command_runner)
    if "processes" in selected:
        _audit_processes(result, command_runner)
    if "docker" in selected:
        _audit_docker(result, command_runner)
    if "ssh" in selected:
        _audit_ssh(result, sshd_config)
    if "firewall" in selected:
        _audit_firewall(result, command_runner, allow_sudo=allow_sudo)
    if "nginx" in selected:
        _audit_nginx(result, command_runner)
    if "os-packages" in selected:
        _audit_os_packages(result, command_runner, include_os_packages=include_os_packages, allow_sudo=allow_sudo)

    _assign_finding_ids(result.findings)
    return result


def run_command(command: list[str]) -> CommandResult:
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError as exc:
        return CommandResult(command=command, exit_code=127, stderr=str(exc))
    except subprocess.TimeoutExpired as exc:
        return CommandResult(command=command, exit_code=124, stdout=exc.stdout or "", stderr=exc.stderr or "timeout")
    return CommandResult(
        command=command,
        exit_code=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )


def save_server_audit_result(project_root: Path, result: ServerAuditResult) -> Path:
    output_dir = project_root / ".ssafer" / "server-audit"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{result.auditId}.json"
    output_path.write_text(json.dumps(to_jsonable(result), ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "last_audit.txt").write_text(output_path.name, encoding="utf-8")
    return output_path


def to_jsonable(result: ServerAuditResult) -> dict:
    payload = asdict(result)
    payload["findings"] = [asdict(finding) for finding in result.findings]
    payload["artifacts"] = [asdict(artifact) for artifact in result.artifacts]
    return payload


def parse_ss_listening_ports(output: str) -> list[dict[str, object]]:
    ports: list[dict[str, object]] = []
    for line in output.splitlines():
        if not line.strip() or line.startswith("Netid"):
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        protocol = parts[0]
        local_address = parts[4]
        match = re.search(r":(\d+)$", local_address)
        if not match:
            continue
        host = local_address[: match.start()]
        ports.append(
            {
                "protocol": protocol,
                "host": host.strip("[]") or "*",
                "port": int(match.group(1)),
                "raw": line,
            }
        )
    return ports


def parse_ssh_settings(content: str) -> dict[str, str]:
    settings: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) == 2:
            settings[parts[0].lower()] = parts[1].strip()
    return settings


def _audit_ports(result: ServerAuditResult, runner: Runner) -> None:
    command_result = runner(["ss", "-tulpen"])
    if command_result.exit_code != 0:
        result.warnings.append("Failed to collect listening ports with ss.")
        result.artifacts.append(ServerArtifact("command-output", "ports", asdict(command_result)))
        return

    ports = parse_ss_listening_ports(command_result.stdout)
    result.artifacts.append(ServerArtifact("listening-ports", "ss -tulpen", ports))
    public_sensitive_ports: dict[int, set[str]] = {}
    for port in ports:
        port_number = int(port["port"])
        service = SENSITIVE_PORTS.get(port_number)
        if not service or not _is_public_host(str(port["host"])):
            continue
        public_sensitive_ports.setdefault(port_number, set()).add(str(port["host"]))

    for port_number, hosts in sorted(public_sensitive_ports.items()):
        service_name, severity = SENSITIVE_PORTS[port_number]
        interfaces = _format_public_interfaces(hosts)
        result.findings.append(
            ServerFinding(
                id="",
                ruleId="SERVER_PUBLIC_SENSITIVE_PORT",
                source="server-audit",
                severity=severity,
                target="ports",
                title=f"{service_name} 포트({port_number})가 외부 인터페이스에 열려 있음",
                evidence=f"{port_number}/tcp ({interfaces})",
            )
        )


def _audit_processes(result: ServerAuditResult, runner: Runner) -> None:
    command_result = runner(["ps", "aux"])
    if command_result.exit_code != 0:
        result.warnings.append("Failed to collect process list.")
    result.artifacts.append(ServerArtifact("command-output", "processes", asdict(command_result)))


def _audit_docker(result: ServerAuditResult, runner: Runner) -> None:
    if shutil.which("docker") is None:
        result.warnings.append("Docker command not found. Docker checks skipped.")
        return
    command_result = runner(["docker", "ps", "--format", "{{json .}}"])
    if command_result.exit_code != 0:
        result.warnings.append("Failed to collect Docker container list.")
    containers = []
    for line in command_result.stdout.splitlines():
        try:
            containers.append(json.loads(line))
        except json.JSONDecodeError:
            containers.append({"raw": line})
    result.artifacts.append(ServerArtifact("docker-containers", "docker ps", containers))


def _audit_ssh(result: ServerAuditResult, sshd_config: Path) -> None:
    if not sshd_config.exists():
        result.warnings.append(f"SSH config not found: {sshd_config}")
        return
    content = sshd_config.read_text(encoding="utf-8", errors="ignore")
    settings = parse_ssh_settings(content)
    result.artifacts.append(ServerArtifact("ssh-config", str(sshd_config), settings))
    if settings.get("permitrootlogin", "").lower() == "yes":
        result.findings.append(
            ServerFinding(
                id="",
                ruleId="SERVER_SSH_ROOT_LOGIN",
                source="server-audit",
                severity="HIGH",
                target=str(sshd_config),
                title="SSH root 로그인이 허용되어 있음",
                evidence="PermitRootLogin yes",
            )
        )
    if settings.get("passwordauthentication", "").lower() == "yes":
        result.findings.append(
            ServerFinding(
                id="",
                ruleId="SERVER_SSH_PASSWORD_AUTH",
                source="server-audit",
                severity="MEDIUM",
                target=str(sshd_config),
                title="SSH 비밀번호 로그인이 허용되어 있음",
                evidence="PasswordAuthentication yes",
            )
        )


def _audit_firewall(result: ServerAuditResult, runner: Runner, *, allow_sudo: bool) -> None:
    ufw = runner(["ufw", "status"])
    iptables = runner(["iptables", "-S"])
    if allow_sudo and _looks_like_permission_error(ufw, iptables):
        ufw = runner(["sudo", "-n", "ufw", "status"])
        iptables = runner(["sudo", "-n", "iptables", "-S"])
    result.artifacts.append(ServerArtifact("command-output", "ufw status", asdict(ufw)))
    result.artifacts.append(ServerArtifact("command-output", "iptables -S", asdict(iptables)))
    if ufw.exit_code == 0 and "Status: inactive" in ufw.stdout:
        result.findings.append(
            ServerFinding(
                id="",
                ruleId="SERVER_FIREWALL_INACTIVE",
                source="server-audit",
                severity="MEDIUM",
                target="firewall",
                title="UFW 방화벽이 비활성화되어 있음",
                evidence="ufw status: inactive",
            )
        )
    if ufw.exit_code != 0 and iptables.exit_code != 0:
        result.warnings.append(_firewall_warning(ufw, iptables))


def _audit_nginx(result: ServerAuditResult, runner: Runner) -> None:
    command_result = runner(["nginx", "-T"])
    if command_result.exit_code == 0:
        result.artifacts.append(ServerArtifact("command-output", "nginx -T", asdict(command_result)))
        return

    result.artifacts.append(ServerArtifact("command-output", "nginx -T", asdict(command_result)))
    docker_result = runner(["docker", "ps", "--format", "{{json .}}"])
    result.artifacts.append(ServerArtifact("command-output", "docker ps for nginx", asdict(docker_result)))
    if docker_result.exit_code != 0:
        result.warnings.append(
            "Host nginx config could not be collected, and Docker nginx fallback failed. "
            "If nginx runs in Docker, check Docker permissions or run the command from a user that can access Docker."
        )
        return

    nginx_containers = _extract_nginx_containers(docker_result.stdout)
    if not nginx_containers:
        result.warnings.append(
            "Host nginx config could not be collected, and no running Docker nginx container was found."
        )
        return

    for container in nginx_containers:
        exec_result = runner(["docker", "exec", container, "nginx", "-T"])
        result.artifacts.append(ServerArtifact("command-output", f"docker exec {container} nginx -T", asdict(exec_result)))
        if exec_result.exit_code == 0:
            return
    result.warnings.append("Docker nginx container was found, but nginx -T failed inside the container.")


def _audit_os_packages(result: ServerAuditResult, runner: Runner, *, include_os_packages: bool, allow_sudo: bool) -> None:
    if shutil.which("trivy") is None:
        result.warnings.append(
            "Trivy command not found. OS package vulnerability checks skipped. "
            "Run 'ssafer install-tools' on this server, then retry with '--include-os-packages'."
        )
        return
    version = runner(["trivy", "--version"])
    result.artifacts.append(ServerArtifact("command-output", "trivy --version", asdict(version)))
    if not include_os_packages:
        result.warnings.append("OS package vulnerability scan skipped. Use --include-os-packages to run Trivy rootfs scan.")
        return
    command = ["trivy", "rootfs", "--scanners", "vuln", "--format", "json", "--quiet", "/"]
    command_result = runner(command)
    retried_with_sudo = False
    if allow_sudo and _looks_like_permission_error(command_result):
        retried_with_sudo = True
        command_result = runner(["sudo", "-n", *command])
    if command_result.exit_code != 0:
        result.warnings.append(_trivy_scan_warning(command_result, retried_with_sudo=retried_with_sudo))
        result.artifacts.append(ServerArtifact("command-output", "trivy rootfs", asdict(command_result)))
        return
    try:
        content = json.loads(command_result.stdout)
    except json.JSONDecodeError:
        content = {"raw": command_result.stdout}
    result.artifacts.append(ServerArtifact("trivy-rootfs-json", "rootfs:/", content))
    _add_trivy_rootfs_findings(result, content)


def _is_public_host(host: str) -> bool:
    normalized = host.strip().lower()
    return normalized in {"*", "0.0.0.0", "::", ":::", "[::]"} or normalized.startswith(":::")


def _format_public_interfaces(hosts: set[str]) -> str:
    normalized = {host.strip().lower() for host in hosts}
    labels: list[str] = []
    if any(host in normalized for host in {"*", "0.0.0.0"}):
        labels.append("IPv4 외부 공개")
    if any(host in normalized for host in {"::", ":::", "[::]"}) or any(host.startswith(":::") for host in normalized):
        labels.append("IPv6 외부 공개")
    if labels:
        return ", ".join(labels)
    return ", ".join(sorted(hosts))


def _add_trivy_rootfs_findings(result: ServerAuditResult, content: object) -> None:
    if not isinstance(content, dict):
        return
    counts = _count_trivy_vulnerabilities_by_severity(content)
    total = sum(counts.values())
    if total == 0:
        return

    severity = "MEDIUM"
    if counts.get("CRITICAL", 0) > 0:
        severity = "CRITICAL"
    elif counts.get("HIGH", 0) > 0:
        severity = "HIGH"

    result.findings.append(
        ServerFinding(
            id="",
            ruleId="SERVER_OS_PACKAGE_VULNERABILITY",
            source="server-audit",
            severity=severity,
            target="rootfs:/",
            title="OS 패키지 취약점이 발견됨",
            evidence=_format_trivy_vulnerability_counts(counts),
        )
    )


def _count_trivy_vulnerabilities_by_severity(content: dict) -> dict[str, int]:
    counts: dict[str, int] = {}
    for scan_result in content.get("Results", []) or []:
        for vulnerability in scan_result.get("Vulnerabilities", []) or []:
            severity = str(vulnerability.get("Severity") or "UNKNOWN").upper()
            counts[severity] = counts.get(severity, 0) + 1
    return counts


def _format_trivy_vulnerability_counts(counts: dict[str, int]) -> str:
    order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]
    parts = [f"{severity}={counts[severity]}" for severity in order if counts.get(severity, 0) > 0]
    extra = sorted(severity for severity in counts if severity not in order)
    parts.extend(f"{severity}={counts[severity]}" for severity in extra)
    return ", ".join(parts) if parts else "0 vulnerabilities"


def _firewall_warning(ufw: CommandResult, iptables: CommandResult) -> str:
    if _looks_like_permission_error(ufw, iptables):
        return (
            "방화벽 상태를 수집하려면 ufw/iptables에 sudo 권한이 필요합니다. "
            "방화벽 상세 점검이 필요하면 sudo 사용을 허용하고 다시 실행하세요."
        )
    if ufw.exit_code == 127 and iptables.exit_code == 127:
        return "ufw와 iptables 명령어를 찾을 수 없어 방화벽 상태를 수집하지 못했습니다."
    return (
        "ufw 또는 iptables로 방화벽 상태를 수집하지 못했습니다. "
        "이 서버는 호스트 방화벽 대신 AWS Security Group에 의존할 수 있습니다."
    )


def _trivy_scan_warning(result: CommandResult, *, retried_with_sudo: bool) -> str:
    error = _short_command_error(result)
    lower_error = error.casefold()
    if "permission denied" in lower_error or "operation not permitted" in lower_error:
        return (
            "Trivy OS package vulnerability scan failed because some files require elevated privileges. "
            "Retry with --allow-sudo if OS package details are needed."
        )
    if "password is required" in lower_error or "a password is required" in lower_error:
        return (
            "Trivy OS package vulnerability scan failed because sudo requires a password in non-interactive mode. "
            "Run from an interactive shell with sudo permission, or configure passwordless sudo for this check."
        )
    if retried_with_sudo:
        return f"Trivy OS package vulnerability scan failed after sudo retry: {error}"
    return f"Trivy OS package vulnerability scan failed: {error}"


def _extract_nginx_containers(output: str) -> list[str]:
    containers: list[str] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            if "nginx" in line.casefold():
                containers.append(line.split()[0])
            continue
        image = str(payload.get("Image") or payload.get("image") or "")
        names = str(payload.get("Names") or payload.get("names") or payload.get("Name") or "")
        container_id = str(payload.get("ID") or payload.get("id") or "")
        target = names or container_id
        if target and ("nginx" in image.casefold() or "nginx" in names.casefold()):
            containers.append(target)
    return containers


def _looks_like_permission_error(*results: CommandResult) -> bool:
    combined = "\n".join(f"{result.stdout}\n{result.stderr}" for result in results).casefold()
    markers = ["permission denied", "must be root", "operation not permitted", "permission"]
    return any(marker in combined for marker in markers)


def _short_command_error(result: CommandResult) -> str:
    text = (result.stderr or result.stdout or "").strip()
    if not text:
        return f"exit {result.exit_code}"
    return text.splitlines()[-1][:200]


def _assign_finding_ids(findings: list[ServerFinding]) -> None:
    for index, finding in enumerate(findings, start=1):
        finding.id = f"SRV-{index:04d}"
