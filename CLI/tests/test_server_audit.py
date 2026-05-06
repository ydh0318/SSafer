from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from ssafer.main import app
from ssafer.server.audit import (
    CommandResult,
    parse_ssh_settings,
    parse_ss_listening_ports,
    run_server_audit,
    save_server_audit_result,
    to_jsonable,
)


def test_parse_ss_listening_ports_extracts_public_ports():
    output = """Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
tcp   LISTEN 0      4096         0.0.0.0:5432      0.0.0.0:*    users:(("postgres",pid=1,fd=3))
tcp   LISTEN 0      4096       127.0.0.1:6379      0.0.0.0:*    users:(("redis",pid=2,fd=3))
tcp   LISTEN 0      4096            [::]:22           [::]:*    users:(("sshd",pid=3,fd=3))
"""

    ports = parse_ss_listening_ports(output)

    assert ports == [
        {"protocol": "tcp", "host": "0.0.0.0", "port": 5432, "raw": 'tcp   LISTEN 0      4096         0.0.0.0:5432      0.0.0.0:*    users:(("postgres",pid=1,fd=3))'},
        {"protocol": "tcp", "host": "127.0.0.1", "port": 6379, "raw": 'tcp   LISTEN 0      4096       127.0.0.1:6379      0.0.0.0:*    users:(("redis",pid=2,fd=3))'},
        {"protocol": "tcp", "host": "::", "port": 22, "raw": 'tcp   LISTEN 0      4096            [::]:22           [::]:*    users:(("sshd",pid=3,fd=3))'},
    ]


def test_server_audit_reports_public_sensitive_port():
    def fake_runner(command: list[str]) -> CommandResult:
        assert command == ["ss", "-tulpen"]
        return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:* users:((\"postgres\"))")

    result = run_server_audit(checks=["ports"], runner=fake_runner)

    assert len(result.findings) == 1
    finding = result.findings[0]
    assert finding.id == "SRV-0001"
    assert finding.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"
    assert finding.severity == "HIGH"
    assert finding.evidence == "0.0.0.0:5432"


def test_server_audit_ignores_localhost_sensitive_port():
    def fake_runner(command: list[str]) -> CommandResult:
        return CommandResult(command, 0, "tcp LISTEN 0 4096 127.0.0.1:6379 0.0.0.0:* users:((\"redis\"))")

    result = run_server_audit(checks=["ports"], runner=fake_runner)

    assert result.findings == []
    assert result.artifacts[0].type == "listening-ports"


def test_parse_ssh_settings_ignores_comments():
    settings = parse_ssh_settings(
        """
#PermitRootLogin prohibit-password
PermitRootLogin yes
PasswordAuthentication no
"""
    )

    assert settings == {
        "permitrootlogin": "yes",
        "passwordauthentication": "no",
    }


def test_server_audit_reports_unsafe_ssh_settings(tmp_path: Path):
    config = tmp_path / "sshd_config"
    config.write_text("PermitRootLogin yes\nPasswordAuthentication yes\n", encoding="utf-8")

    result = run_server_audit(checks=["ssh"], sshd_config=config)

    assert [finding.ruleId for finding in result.findings] == [
        "SERVER_SSH_ROOT_LOGIN",
        "SERVER_SSH_PASSWORD_AUTH",
    ]


def test_server_audit_records_firewall_inactive():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ufw", "status"]:
            return CommandResult(command, 0, "Status: inactive")
        if command == ["iptables", "-S"]:
            return CommandResult(command, 0, "-P INPUT ACCEPT")
        raise AssertionError(command)

    result = run_server_audit(checks=["firewall"], runner=fake_runner)

    assert len(result.findings) == 1
    assert result.findings[0].ruleId == "SERVER_FIREWALL_INACTIVE"


def test_server_audit_firewall_warning_explains_permission_issue():
    def fake_runner(command: list[str]) -> CommandResult:
        return CommandResult(command, 1, stderr="Permission denied")

    result = run_server_audit(checks=["firewall"], runner=fake_runner)

    assert "elevated privileges" in result.warnings[0]


def test_server_audit_nginx_falls_back_to_docker_container():
    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CommandResult:
        commands.append(command)
        if command == ["nginx", "-T"]:
            return CommandResult(command, 127, stderr="nginx: command not found")
        if command == ["docker", "ps", "--format", "{{json .}}"]:
            return CommandResult(command, 0, '{"Names":"ssafer-nginx","Image":"nginx:1.27"}\n')
        if command == ["docker", "exec", "ssafer-nginx", "nginx", "-T"]:
            return CommandResult(command, 0, "server { listen 80; }")
        raise AssertionError(command)

    result = run_server_audit(checks=["nginx"], runner=fake_runner)

    assert result.warnings == []
    assert ["docker", "exec", "ssafer-nginx", "nginx", "-T"] in commands


def test_server_audit_trivy_warning_suggests_install_tools(monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(audit_module.shutil, "which", lambda name: None)

    result = run_server_audit(checks=["os-packages"], runner=lambda command: CommandResult(command, 0, ""))

    assert "ssafer install-tools" in result.warnings[0]
    assert "--include-os-packages" in result.warnings[0]


def test_save_server_audit_result_writes_json_and_marker(tmp_path: Path):
    result = run_server_audit(checks=["ports"], runner=lambda command: CommandResult(command, 0, ""))

    output_path = save_server_audit_result(tmp_path, result)

    assert output_path.exists()
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["source"] == "server-audit"
    assert (tmp_path / ".ssafer" / "server-audit" / "last_audit.txt").read_text(encoding="utf-8") == output_path.name


def test_to_jsonable_uses_expected_shape():
    result = run_server_audit(checks=["ports"], runner=lambda command: CommandResult(command, 0, ""))

    payload = to_jsonable(result)

    assert payload["schemaVersion"] == "0.1"
    assert payload["source"] == "server-audit"
    assert isinstance(payload["findings"], list)
    assert isinstance(payload["warnings"], list)
    assert isinstance(payload["artifacts"], list)


def test_server_audit_command_saves_result(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(
        audit_module,
        "run_command",
        lambda command: CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:*"),
    )

    result = CliRunner().invoke(app, ["server-audit", "--path", str(tmp_path), "--checks", "ports"])

    assert result.exit_code == 0
    assert "Server audit saved" in result.output
    assert (tmp_path / ".ssafer" / "server-audit" / "last_audit.txt").exists()


def test_server_audit_command_details_prints_findings_and_artifacts(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(
        audit_module,
        "run_command",
        lambda command: CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:*"),
    )

    result = CliRunner().invoke(app, ["server-audit", "--path", str(tmp_path), "--checks", "ports", "--details"])

    assert result.exit_code == 0
    assert "Server audit findings" in result.output
    assert "0.0.0.0:5432" in result.output
    assert "Server audit artifacts" in result.output
    assert "listening-ports" in result.output
