from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from ssafer.main import app
from ssafer.server.audit import (
    CommandResult,
    DEFAULT_COMMAND_TIMEOUT_SECONDS,
    TRIVY_ROOTFS_TIMEOUT_SECONDS,
    _command_timeout_seconds,
    _resolve_firewall_state,
    parse_docker_inspect_ports,
    parse_docker_ports_from_ps,
    parse_docker_user_rules,
    parse_iptables_input_rules,
    parse_ssh_settings,
    parse_ss_listening_ports,
    parse_ufw_rules,
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


def test_trivy_rootfs_uses_longer_command_timeout():
    assert _command_timeout_seconds(["ss", "-tulpen"]) == DEFAULT_COMMAND_TIMEOUT_SECONDS
    assert (
        _command_timeout_seconds(["trivy", "rootfs", "--scanners", "vuln", "/"])
        == TRIVY_ROOTFS_TIMEOUT_SECONDS
    )
    assert (
        _command_timeout_seconds(["sudo", "-n", "trivy", "rootfs", "--scanners", "vuln", "/"])
        == TRIVY_ROOTFS_TIMEOUT_SECONDS
    )


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
    assert finding.title == "PostgreSQL 포트(5432)가 외부 인터페이스에 열려 있음"
    assert finding.evidence == "5432/tcp (IPv4 외부 공개)"


def test_server_audit_groups_ipv4_and_ipv6_public_port_findings():
    output = "\n".join(
        [
            "tcp LISTEN 0 4096 0.0.0.0:22 0.0.0.0:* users:((\"sshd\"))",
            "tcp LISTEN 0 4096 [::]:22 [::]:* users:((\"sshd\"))",
        ]
    )

    result = run_server_audit(checks=["ports"], runner=lambda command: CommandResult(command, 0, output))

    assert len(result.findings) == 1
    assert result.findings[0].evidence == "22/tcp (IPv4 외부 공개, IPv6 외부 공개)"


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
        if "iptables" in command:
            return CommandResult(command, 0, "-P INPUT ACCEPT")
        raise AssertionError(command)

    result = run_server_audit(checks=["firewall"], runner=fake_runner)

    assert len(result.findings) == 1
    assert result.findings[0].ruleId == "SERVER_FIREWALL_INACTIVE"


def test_server_audit_firewall_warning_explains_permission_issue():
    def fake_runner(command: list[str]) -> CommandResult:
        return CommandResult(command, 1, stderr="Permission denied")

    result = run_server_audit(checks=["firewall"], runner=fake_runner)

    assert "sudo 권한" in result.warnings[0]


def test_server_audit_firewall_uses_sudo_when_allowed():
    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CommandResult:
        commands.append(command)
        if command[0] == "sudo":
            return CommandResult(command, 0, "Status: active")
        return CommandResult(command, 1, stderr="Permission denied")

    result = run_server_audit(checks=["firewall"], runner=fake_runner, allow_sudo=True)

    assert result.warnings == []
    assert ["sudo", "-n", "ufw", "status"] in commands
    assert ["sudo", "-n", "iptables", "-S"] in commands


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


def test_server_audit_trivy_rootfs_retries_with_sudo_when_allowed(monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(audit_module.shutil, "which", lambda name: "/usr/bin/trivy" if name == "trivy" else None)
    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CommandResult:
        commands.append(command)
        if command[0] == "sudo":
            return CommandResult(command, 0, '{"Results":[]}')
        return CommandResult(command, 1, stderr="permission denied")

    result = run_server_audit(
        checks=["os-packages"],
        include_os_packages=True,
        allow_sudo=True,
        runner=fake_runner,
    )

    assert result.warnings == []
    assert any(command[:3] == ["sudo", "-n", "trivy"] for command in commands)


def test_server_audit_trivy_rootfs_adds_summary_finding(monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(audit_module.shutil, "which", lambda name: "/usr/bin/trivy" if name == "trivy" else None)

    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["trivy", "--version"]:
            return CommandResult(command, 0, "Version: 0.69.3")
        if command[:3] == ["trivy", "rootfs", "--scanners"]:
            return CommandResult(
                command,
                0,
                json.dumps(
                    {
                        "Results": [
                            {
                                "Target": "/",
                                "Vulnerabilities": [
                                    {"VulnerabilityID": "CVE-1", "Severity": "CRITICAL"},
                                    {"VulnerabilityID": "CVE-2", "Severity": "HIGH"},
                                    {"VulnerabilityID": "CVE-3", "Severity": "HIGH"},
                                ],
                            }
                        ]
                    }
                ),
            )
        raise AssertionError(command)

    result = run_server_audit(
        checks=["os-packages"],
        include_os_packages=True,
        runner=fake_runner,
    )

    assert result.warnings == []
    assert result.findings[0].ruleId == "SERVER_OS_PACKAGE_VULNERABILITY"
    assert result.findings[0].severity == "CRITICAL"
    assert result.findings[0].evidence == "CRITICAL=1, HIGH=2"
    assert [artifact.type for artifact in result.artifacts] == ["command-output", "trivy-rootfs-json"]


def test_server_audit_trivy_permission_failure_suggests_allow_sudo(monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(audit_module.shutil, "which", lambda name: "/usr/bin/trivy" if name == "trivy" else None)

    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["trivy", "--version"]:
            return CommandResult(command, 0, "Version: 0.69.3")
        return CommandResult(command, 1, stderr="open /opt/app/secret.jar: permission denied")

    result = run_server_audit(
        checks=["os-packages"],
        include_os_packages=True,
        runner=fake_runner,
    )

    assert "Retry with --allow-sudo" in result.warnings[0]
    assert result.artifacts[-1].target == "trivy rootfs"


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
    assert "Running server audit..." in result.output
    assert "서버 점검 결과 저장" in result.output
    assert (tmp_path / ".ssafer" / "server-audit" / "last_audit.txt").exists()


def test_server_audit_command_prints_long_running_os_package_notice(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(
        audit_module,
        "run_command",
        lambda command: CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:*"),
    )

    result = CliRunner().invoke(
        app,
        ["server-audit", "--path", str(tmp_path), "--checks", "ports", "--include-os-packages"],
    )

    assert result.exit_code == 0
    assert "Running server audit. OS package scan can take several minutes..." in result.output


def test_server_audit_command_noninteractive_skips_sudo_prompt(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CommandResult:
        commands.append(command)
        return CommandResult(command, 1, stderr="Permission denied")

    monkeypatch.setattr(audit_module, "run_command", fake_runner)

    result = CliRunner().invoke(app, ["server-audit", "--path", str(tmp_path), "--checks", "firewall"])

    assert result.exit_code == 0
    assert "Non-interactive session detected" in result.output
    assert ["sudo", "-n", "ufw", "status"] not in commands
    assert ["sudo", "-n", "iptables", "-S"] not in commands


def test_server_audit_command_allow_sudo_retries_without_prompt(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CommandResult:
        commands.append(command)
        if command[0] == "sudo":
            return CommandResult(command, 0, "Status: active")
        return CommandResult(command, 1, stderr="Permission denied")

    monkeypatch.setattr(audit_module, "run_command", fake_runner)

    result = CliRunner().invoke(app, ["server-audit", "--path", str(tmp_path), "--checks", "firewall", "--allow-sudo"])

    assert result.exit_code == 0
    assert "Non-interactive session detected" not in result.output
    assert ["sudo", "-n", "ufw", "status"] in commands
    assert ["sudo", "-n", "iptables", "-S"] in commands


def test_server_audit_command_details_prints_findings_and_artifacts(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module

    monkeypatch.setattr(
        audit_module,
        "run_command",
        lambda command: CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:*"),
    )

    result = CliRunner().invoke(app, ["server-audit", "--path", str(tmp_path), "--checks", "ports", "--details"])

    assert result.exit_code == 0
    assert "서버 점검 Findings" in result.output
    assert "PUBLIC_PORT" in result.output
    assert "5432/tcp" in result.output
    assert "IPv4" in result.output
    assert "서버 점검 산출물" in result.output
    assert "listening-ports" in result.output


def test_server_audit_command_uploads_saved_result(tmp_path: Path, monkeypatch):
    from ssafer.server import audit as audit_module
    import ssafer.main as main_module

    monkeypatch.setattr(
        audit_module,
        "run_command",
        lambda command: CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:5432 0.0.0.0:*"),
    )

    captured: dict[str, object] = {}

    def fake_upload(path: Path, api_url: str | None = None, on_step=None):
        captured["path"] = path
        captured["api_url"] = api_url
        return {"scanId": 777}

    monkeypatch.setattr(main_module, "_upload_server_audit_or_exit", fake_upload)
    monkeypatch.setattr(
        main_module,
        "_wait_for_uploaded_scan",
        lambda path, response, api_url=None: {**response, "status": "DONE", "_apiUrl": "https://api.example.com"},
    )

    result = CliRunner().invoke(
        app,
        ["server-audit", "--path", str(tmp_path), "--checks", "ports", "--upload", "--api-url", "https://api.example.com"],
    )

    assert result.exit_code == 0
    assert captured == {
        "path": tmp_path,
        "api_url": "https://api.example.com",
    }
    assert "777" in result.output


# ── parse_ufw_rules ────────────────────────────────────────────────────────

def test_parse_ufw_allow_and_deny():
    output = """\
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
3306/tcp                   DENY        Anywhere
80/tcp                     ALLOW       Anywhere
"""
    rules = parse_ufw_rules(output)
    assert rules[22] == ["ALLOW"]
    assert rules[3306] == ["DENY"]
    assert rules[80] == ["ALLOW"]


def test_parse_ufw_inactive_returns_empty():
    rules = parse_ufw_rules("Status: inactive\n")
    assert rules == {}


# ── parse_iptables_input_rules ──────────────────────────────────────────────

def test_parse_iptables_accept_and_drop():
    output = """\
-P INPUT ACCEPT
-P FORWARD DROP
-P OUTPUT ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 3306 -j DROP
-A INPUT -p tcp --dport 5432 -j REJECT
"""
    rules = parse_iptables_input_rules(output)
    assert rules[22] == ["ALLOW"]
    assert rules[3306] == ["DENY"]
    assert rules[5432] == ["DENY"]


def test_parse_iptables_ignores_policy_and_output_chain():
    output = "-P INPUT ACCEPT\n-A OUTPUT -p tcp --dport 443 -j ACCEPT\n"
    rules = parse_iptables_input_rules(output)
    assert rules == {}


# ── _resolve_firewall_state ─────────────────────────────────────────────────

def test_resolve_deny_overrides_allow():
    ufw = {3306: ["ALLOW"]}
    iptables = {3306: ["DENY"]}
    state = _resolve_firewall_state(ufw, iptables)
    assert state[3306] == "DENY"


def test_resolve_merges_both_sources():
    ufw = {22: ["ALLOW"]}
    iptables = {3306: ["DENY"]}
    state = _resolve_firewall_state(ufw, iptables)
    assert state[22] == "ALLOW"
    assert state[3306] == "DENY"


# ── cross_validate (integration) ───────────────────────────────────────────

def test_cross_validate_firewall_deny_lowers_severity():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:3306 0.0.0.0:*")
        if "ufw" in command:
            return CommandResult(command, 0, "Status: active\n\n3306/tcp DENY Anywhere\n")
        if "iptables" in command:
            return CommandResult(command, 0, "")
        return CommandResult(command, 0, "")

    result = run_server_audit(checks=["ports", "firewall"], runner=fake_runner)
    port_findings = [f for f in result.findings if f.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"]
    assert len(port_findings) == 1
    assert port_findings[0].severity == "LOW"
    assert "방화벽 차단됨" in port_findings[0].title


def test_cross_validate_firewall_allow_stays_critical():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:3306 0.0.0.0:*")
        if "ufw" in command:
            return CommandResult(command, 0, "Status: active\n\n3306/tcp ALLOW Anywhere\n")
        if "iptables" in command:
            return CommandResult(command, 0, "")
        return CommandResult(command, 0, "")

    result = run_server_audit(checks=["ports", "firewall"], runner=fake_runner)
    port_findings = [f for f in result.findings if f.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"]
    assert len(port_findings) == 1
    assert port_findings[0].severity == "CRITICAL"
    assert "방화벽 허용됨" in port_findings[0].title


def test_cross_validate_no_firewall_rule_becomes_medium():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:3306 0.0.0.0:*")
        if "ufw" in command:
            return CommandResult(command, 0, "Status: active\n\n22/tcp ALLOW Anywhere\n")
        if "iptables" in command:
            return CommandResult(command, 0, "")
        return CommandResult(command, 0, "")

    result = run_server_audit(checks=["ports", "firewall"], runner=fake_runner)
    port_findings = [f for f in result.findings if f.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"]
    assert len(port_findings) == 1
    assert port_findings[0].severity == "MEDIUM"
    assert "방화벽 규칙 없음" in port_findings[0].title


def test_cross_validate_ufw_active_no_port_rule_becomes_medium():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:3306 0.0.0.0:*")
        if "ufw" in command:
            return CommandResult(command, 0, "Status: active\n\nTo Action From\n-- ------ ----\n")
        if "iptables" in command:
            return CommandResult(command, 1, stderr="command not found")
        return CommandResult(command, 0, "")

    result = run_server_audit(checks=["ports", "firewall"], runner=fake_runner)
    port_findings = [f for f in result.findings if f.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"]
    assert len(port_findings) == 1
    assert port_findings[0].severity == "MEDIUM"
    assert "방화벽 규칙 없음" in port_findings[0].title


def test_cross_validate_no_firewall_data_preserves_severity():
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "tcp LISTEN 0 4096 0.0.0.0:3306 0.0.0.0:*")
        return CommandResult(command, 1, stderr="command not found")

    result = run_server_audit(checks=["ports", "firewall"], runner=fake_runner)
    port_findings = [f for f in result.findings if f.ruleId == "SERVER_PUBLIC_SENSITIVE_PORT"]
    assert len(port_findings) == 1
    assert port_findings[0].severity == "HIGH"


# ── parse_docker_ports_from_ps ──────────────────────────────────────────────

def test_parse_docker_ports_public_publish():
    containers = [{"Names": "ssafer-spring", "ID": "abc123", "Ports": "0.0.0.0:8080->8080/tcp"}]
    ports = parse_docker_ports_from_ps(containers)
    assert len(ports) == 1
    assert ports[0].host_port == 8080
    assert ports[0].public is True


def test_parse_docker_ports_localhost_publish():
    containers = [{"Names": "redis", "ID": "def456", "Ports": "127.0.0.1:6379->6379/tcp"}]
    ports = parse_docker_ports_from_ps(containers)
    assert len(ports) == 1
    assert ports[0].host_port == 6379
    assert ports[0].public is False


def test_parse_docker_ports_multiple():
    containers = [{"Names": "app", "ID": "ghi789", "Ports": "0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 127.0.0.1:5432->5432/tcp"}]
    ports = parse_docker_ports_from_ps(containers)
    assert len(ports) == 3
    public = [p for p in ports if p.public]
    assert len(public) == 2


def test_parse_docker_ports_empty_host_ip_is_public():
    containers = [{"Names": "app", "ID": "jkl012", "Ports": "3306->3306/tcp"}]
    ports = parse_docker_ports_from_ps(containers)
    assert len(ports) == 1
    assert ports[0].public is True


# ── parse_docker_inspect_ports ──────────────────────────────────────────────

def test_parse_docker_inspect_public():
    inspect_json = json.dumps([{
        "Id": "abc123456789",
        "Name": "/ssafer-spring",
        "NetworkSettings": {
            "Ports": {
                "8080/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]
            }
        }
    }])
    ports = parse_docker_inspect_ports(inspect_json)
    assert len(ports) == 1
    assert ports[0].public is True
    assert ports[0].container_name == "ssafer-spring"


def test_parse_docker_inspect_localhost():
    inspect_json = json.dumps([{
        "Id": "def456789012",
        "Name": "/redis",
        "NetworkSettings": {
            "Ports": {
                "6379/tcp": [{"HostIp": "127.0.0.1", "HostPort": "6379"}]
            }
        }
    }])
    ports = parse_docker_inspect_ports(inspect_json)
    assert len(ports) == 1
    assert ports[0].public is False


def test_parse_docker_inspect_no_bindings():
    inspect_json = json.dumps([{
        "Id": "xyz",
        "Name": "/internal",
        "NetworkSettings": {"Ports": {"8080/tcp": None}}
    }])
    ports = parse_docker_inspect_ports(inspect_json)
    assert ports == []


# ── parse_docker_user_rules ─────────────────────────────────────────────────

def test_parse_docker_user_drop():
    output = "-A DOCKER-USER -p tcp --dport 3306 -j DROP\n-A DOCKER-USER -j RETURN\n"
    rules = parse_docker_user_rules(output)
    assert rules[3306] == ["DENY"]


def test_parse_docker_user_accept():
    output = "-A DOCKER-USER -p tcp --dport 8080 -j ACCEPT\n"
    rules = parse_docker_user_rules(output)
    assert rules[8080] == ["ALLOW"]


def test_parse_docker_user_empty():
    output = "-A DOCKER-USER -j RETURN\n"
    rules = parse_docker_user_rules(output)
    assert rules == {}


# ── Docker publish finding (integration) ────────────────────────────────────

def _docker_audit_runner(
    docker_ps_ports: str = "0.0.0.0:3306->3306/tcp",
    docker_user_output: str = "",
    inspect_output: str = "",
):
    def fake_runner(command: list[str]) -> CommandResult:
        if command == ["ss", "-tulpen"]:
            return CommandResult(command, 0, "")
        if command == ["docker", "ps", "--format", "{{json .}}"]:
            return CommandResult(command, 0, json.dumps({"Names": "db", "ID": "abc123", "Ports": docker_ps_ports}))
        if command[0] == "docker" and "inspect" in command:
            return CommandResult(command, 0, inspect_output) if inspect_output else CommandResult(command, 1)
        if "ufw" in command:
            return CommandResult(command, 0, "Status: active\n")
        if command[-1] == "DOCKER-USER":
            return CommandResult(command, 0, docker_user_output)
        if "iptables" in command:
            return CommandResult(command, 0, "")
        return CommandResult(command, 0, "")
    return fake_runner


def test_docker_public_publish_no_docker_user_is_high():
    runner = _docker_audit_runner(docker_ps_ports="0.0.0.0:3306->3306/tcp")
    result = run_server_audit(checks=["docker", "firewall"], runner=runner)
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert len(findings) == 1
    assert findings[0].severity == "HIGH"
    assert "DOCKER-USER 규칙 없음" in findings[0].title


def test_docker_public_publish_docker_user_drop_is_medium():
    runner = _docker_audit_runner(
        docker_ps_ports="0.0.0.0:3306->3306/tcp",
        docker_user_output="-A DOCKER-USER -p tcp --dport 3306 -j DROP\n-A DOCKER-USER -j RETURN\n",
    )
    result = run_server_audit(checks=["docker", "firewall"], runner=runner)
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert len(findings) == 1
    assert findings[0].severity == "MEDIUM"
    assert "DOCKER-USER 차단됨" in findings[0].title


def test_docker_localhost_publish_no_finding():
    runner = _docker_audit_runner(docker_ps_ports="127.0.0.1:6379->6379/tcp")
    result = run_server_audit(checks=["docker", "firewall"], runner=runner)
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert findings == []


def test_docker_allowlist_port_no_finding():
    runner = _docker_audit_runner(docker_ps_ports="0.0.0.0:443->443/tcp")
    result = run_server_audit(checks=["docker", "firewall"], runner=runner)
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert findings == []


def test_docker_custom_allowlist():
    runner = _docker_audit_runner(docker_ps_ports="0.0.0.0:8080->8080/tcp")
    result = run_server_audit(
        checks=["docker", "firewall"],
        runner=runner,
        allowed_ports=frozenset({22, 80, 443, 8080}),
    )
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert findings == []


def test_docker_inspect_overrides_ps():
    inspect_json = json.dumps([{
        "Id": "abc123456789",
        "Name": "/db",
        "NetworkSettings": {
            "Ports": {
                "3306/tcp": [{"HostIp": "127.0.0.1", "HostPort": "3306"}]
            }
        }
    }])
    runner = _docker_audit_runner(
        docker_ps_ports="0.0.0.0:3306->3306/tcp",
        inspect_output=inspect_json,
    )
    result = run_server_audit(checks=["docker", "firewall"], runner=runner)
    findings = [f for f in result.findings if f.ruleId == "SERVER_DOCKER_PUBLIC_PUBLISHED_PORT"]
    assert findings == []
