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
        _audit_firewall(result, command_runner)
    if "nginx" in selected:
        _audit_nginx(result, command_runner)
    if "os-packages" in selected:
        _audit_os_packages(result, command_runner, include_os_packages=include_os_packages)

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
    for port in ports:
        port_number = int(port["port"])
        service = SENSITIVE_PORTS.get(port_number)
        if not service or not _is_public_host(str(port["host"])):
            continue
        service_name, severity = service
        result.findings.append(
            ServerFinding(
                id="",
                ruleId="SERVER_PUBLIC_SENSITIVE_PORT",
                source="server-audit",
                severity=severity,
                target="ports",
                title=f"{service_name} port is listening on a public interface",
                evidence=f"{port['host']}:{port_number}",
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
                title="SSH root login is enabled",
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
                title="SSH password authentication is enabled",
                evidence="PasswordAuthentication yes",
            )
        )


def _audit_firewall(result: ServerAuditResult, runner: Runner) -> None:
    ufw = runner(["ufw", "status"])
    iptables = runner(["iptables", "-S"])
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
                title="UFW firewall is inactive",
                evidence="ufw status: inactive",
            )
        )
    if ufw.exit_code != 0 and iptables.exit_code != 0:
        result.warnings.append("Failed to collect firewall status with ufw and iptables.")


def _audit_nginx(result: ServerAuditResult, runner: Runner) -> None:
    command_result = runner(["nginx", "-T"])
    if command_result.exit_code != 0:
        result.warnings.append("nginx command failed or nginx is not installed. nginx checks skipped.")
    result.artifacts.append(ServerArtifact("command-output", "nginx -T", asdict(command_result)))


def _audit_os_packages(result: ServerAuditResult, runner: Runner, *, include_os_packages: bool) -> None:
    if shutil.which("trivy") is None:
        result.warnings.append("Trivy command not found. OS package vulnerability checks skipped.")
        return
    if not include_os_packages:
        result.warnings.append("OS package vulnerability scan skipped. Use --include-os-packages to run Trivy rootfs scan.")
        version = runner(["trivy", "--version"])
        result.artifacts.append(ServerArtifact("command-output", "trivy --version", asdict(version)))
        return
    command_result = runner(["trivy", "rootfs", "--scanners", "vuln", "--format", "json", "--quiet", "/"])
    if command_result.exit_code != 0:
        result.warnings.append("Trivy OS package vulnerability scan failed.")
        result.artifacts.append(ServerArtifact("command-output", "trivy rootfs", asdict(command_result)))
        return
    try:
        content = json.loads(command_result.stdout)
    except json.JSONDecodeError:
        content = {"raw": command_result.stdout}
    result.artifacts.append(ServerArtifact("trivy-rootfs-json", "rootfs:/", content))


def _is_public_host(host: str) -> bool:
    normalized = host.strip().lower()
    return normalized in {"*", "0.0.0.0", "::", ":::", "[::]"} or normalized.startswith(":::")


def _assign_finding_ids(findings: list[ServerFinding]) -> None:
    for index, finding in enumerate(findings, start=1):
        finding.id = f"SRV-{index:04d}"
