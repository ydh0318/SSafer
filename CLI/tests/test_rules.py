from __future__ import annotations

from pathlib import Path

import pytest

from ssafer.core.compose import ComposeSet
from ssafer.rules import Finding, RuleEngine, ScanContext
from ssafer.rules.compose_rules import (
    ComposeExposedDbPortRule,
    ComposeHardcodedSecretRule,
    ComposeHostNetworkRule,
    ComposeLatestTagRule,
    ComposeNoMemoryLimitRule,
    ComposePrivilegedModeRule,
    ComposeRootUserRule,
)
from ssafer.rules.env_rules import EnvPlainSecretRule


def _ctx(effective: dict[str, str] | None = None, env_files: list[Path] | None = None, root: Path | None = None) -> ScanContext:
    return ScanContext(
        compose_sets=[],
        effective_configs=effective or {},
        env_files=env_files or [],
        project_root=root or Path("."),
    )


# ── COMPOSE_EXPOSED_DB_PORT ──────────────────────────────────────────────────

def test_compose_exposed_db_port_detects_mysql_port():
    yaml = """
services:
  db:
    image: mysql:8
    ports:
      - "3306:3306"
"""
    findings = ComposeExposedDbPortRule().check(_ctx({"default": yaml}))
    assert any(f.rule_id == "COMPOSE_EXPOSED_DB_PORT" for f in findings)


def test_compose_exposed_db_port_detects_postgres():
    yaml = """
services:
  db:
    image: postgres:15
    ports:
      - "5432:5432"
"""
    findings = ComposeExposedDbPortRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_exposed_db_port_ignores_non_db_port():
    yaml = """
services:
  web:
    image: nginx
    ports:
      - "80:80"
"""
    findings = ComposeExposedDbPortRule().check(_ctx({"default": yaml}))
    assert findings == []


def test_compose_exposed_db_port_ignores_no_ports():
    yaml = """
services:
  app:
    image: myapp:1.0
"""
    findings = ComposeExposedDbPortRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_PRIVILEGED_MODE ──────────────────────────────────────────────────

def test_compose_privileged_mode_detects_true():
    yaml = """
services:
  app:
    image: myapp:1.0
    privileged: true
"""
    findings = ComposePrivilegedModeRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1
    assert findings[0].severity == "HIGH"


def test_compose_privileged_mode_ignores_false():
    yaml = """
services:
  app:
    image: myapp:1.0
    privileged: false
"""
    findings = ComposePrivilegedModeRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_HOST_NETWORK ─────────────────────────────────────────────────────

def test_compose_host_network_detects():
    yaml = """
services:
  app:
    image: myapp:1.0
    network_mode: host
"""
    findings = ComposeHostNetworkRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_host_network_ignores_bridge():
    yaml = """
services:
  app:
    image: myapp:1.0
    network_mode: bridge
"""
    findings = ComposeHostNetworkRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_HARDCODED_SECRET ─────────────────────────────────────────────────

def test_compose_hardcoded_secret_detects_plaintext():
    yaml = """
services:
  app:
    image: myapp:1.0
    environment:
      DB_PASSWORD: supersecret
"""
    findings = ComposeHardcodedSecretRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_hardcoded_secret_ignores_env_ref():
    yaml = """
services:
  app:
    image: myapp:1.0
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
"""
    findings = ComposeHardcodedSecretRule().check(_ctx({"default": yaml}))
    assert findings == []


def test_compose_hardcoded_secret_ignores_empty():
    yaml = """
services:
  app:
    image: myapp:1.0
    environment:
      DB_PASSWORD: ""
"""
    findings = ComposeHardcodedSecretRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_LATEST_TAG ───────────────────────────────────────────────────────

def test_compose_latest_tag_detects_latest():
    yaml = """
services:
  app:
    image: myapp:latest
"""
    findings = ComposeLatestTagRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_latest_tag_detects_no_tag():
    yaml = """
services:
  app:
    image: myapp
"""
    findings = ComposeLatestTagRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_latest_tag_ignores_pinned_tag():
    yaml = """
services:
  app:
    image: myapp:1.2.3
"""
    findings = ComposeLatestTagRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_ROOT_USER ────────────────────────────────────────────────────────

def test_compose_root_user_detects_root():
    yaml = """
services:
  app:
    image: myapp:1.0
    user: root
"""
    findings = ComposeRootUserRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_root_user_detects_zero():
    yaml = """
services:
  app:
    image: myapp:1.0
    user: "0"
"""
    findings = ComposeRootUserRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_root_user_ignores_nonroot():
    yaml = """
services:
  app:
    image: myapp:1.0
    user: "1000:1000"
"""
    findings = ComposeRootUserRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── COMPOSE_NO_MEMORY_LIMIT ──────────────────────────────────────────────────

def test_compose_no_memory_limit_detects_missing():
    yaml = """
services:
  app:
    image: myapp:1.0
    deploy:
      resources:
        reservations:
          memory: 128M
"""
    findings = ComposeNoMemoryLimitRule().check(_ctx({"default": yaml}))
    assert len(findings) == 1


def test_compose_no_memory_limit_ignores_set_limit():
    yaml = """
services:
  app:
    image: myapp:1.0
    deploy:
      resources:
        limits:
          memory: 512M
"""
    findings = ComposeNoMemoryLimitRule().check(_ctx({"default": yaml}))
    assert findings == []


def test_compose_no_memory_limit_ignores_no_deploy_section():
    yaml = """
services:
  app:
    image: myapp:1.0
"""
    findings = ComposeNoMemoryLimitRule().check(_ctx({"default": yaml}))
    assert findings == []


# ── ENV_PLAIN_SECRET ─────────────────────────────────────────────────────────

def test_env_plain_secret_detects_hardcoded(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("DB_PASSWORD=supersecret123\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert len(findings) == 1
    assert findings[0].line == 1
    assert "supersecret" not in findings[0].masked_evidence


def test_env_plain_secret_strips_utf8_bom_from_key(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("\ufeffDB_PASSWORD=supersecret123\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert len(findings) == 1
    assert "DB_PASSWORD" in findings[0].title
    assert "\ufeff" not in findings[0].title
    assert findings[0].masked_evidence == "DB_PASSWORD=***MASKED***"


def test_env_plain_secret_ignores_placeholder(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("DB_PASSWORD=changeme\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert findings == []


@pytest.mark.parametrize(
    "value",
    [
        "your_gms_api_key_here",
        "your-token",
        "replace_me",
        "dummy",
        "sample",
        "xxx",
    ],
)
def test_env_plain_secret_ignores_common_placeholder_values(tmp_path: Path, value: str):
    env_file = tmp_path / ".env.example"
    env_file.write_text(f"GMS_API_KEY={value}\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert findings == []


def test_env_example_secret_like_value_is_medium(tmp_path: Path):
    env_file = tmp_path / ".env.example"
    env_file.write_text("GMS_API_KEY=real-looking-key-1234567890\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert len(findings) == 1
    assert findings[0].severity == "MEDIUM"
    assert "예시 파일" in findings[0].title


def test_env_plain_secret_ignores_empty(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("DB_PASSWORD=\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert findings == []


def test_env_plain_secret_ignores_comment(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("# DB_PASSWORD=supersecret\n", encoding="utf-8")
    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))
    assert findings == []


def test_env_plain_secret_git_ignored_file_is_low(tmp_path: Path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("DB_PASSWORD=supersecret123\n", encoding="utf-8")
    calls: list[list[str]] = []

    def fake_git_check(command: list[str]) -> bool:
        calls.append(command)
        if "rev-parse" in command:
            return True
        if "ls-files" in command:
            return False
        if "check-ignore" in command:
            return True
        return False

    monkeypatch.setattr("ssafer.rules.env_rules._git_check", fake_git_check)

    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))

    assert len(findings) == 1
    assert findings[0].severity == "LOW"
    assert "Git ignore" in findings[0].title
    assert any("check-ignore" in command for command in calls)


def test_env_plain_secret_git_tracked_file_stays_high(tmp_path: Path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("DB_PASSWORD=supersecret123\n", encoding="utf-8")

    def fake_git_check(command: list[str]) -> bool:
        if "rev-parse" in command:
            return True
        if "ls-files" in command:
            return True
        return False

    monkeypatch.setattr("ssafer.rules.env_rules._git_check", fake_git_check)

    findings = EnvPlainSecretRule().check(_ctx(env_files=[env_file], root=tmp_path))

    assert len(findings) == 1
    assert findings[0].severity == "HIGH"


# ── RuleEngine ───────────────────────────────────────────────────────────────

def test_rule_engine_assigns_sequential_fnd_ids():
    yaml = """
services:
  app:
    image: myapp:latest
    privileged: true
"""
    engine = RuleEngine()
    findings = engine.run(_ctx({"default": yaml}))
    ids = [f.id for f in findings]
    assert ids[0] == "FND-0001"
    assert ids[1] == "FND-0002"
    for i, fid in enumerate(ids, start=1):
        assert fid == f"FND-{i:04d}"


def test_rule_engine_masked_evidence_max_120_chars():
    yaml = """
services:
  app:
    image: myapp:latest
    environment:
      DB_PASSWORD: somesecretvalue
"""
    engine = RuleEngine()
    findings = engine.run(_ctx({"default": yaml}))
    for f in findings:
        assert len(f.masked_evidence) <= 120


def test_rule_engine_source_is_always_custom_rule():
    yaml = """
services:
  app:
    image: myapp:latest
    privileged: true
    network_mode: host
    environment:
      API_KEY: hardcoded
"""
    engine = RuleEngine()
    findings = engine.run(_ctx({"default": yaml}))
    assert len(findings) > 0
    for f in findings:
        assert f.source == "custom-rule"


def test_rule_engine_records_failed_rule_warning():
    class FailingRule:
        rule_id = "BROKEN_RULE"
        severity = "HIGH"

        def check(self, context: ScanContext) -> list[Finding]:
            raise RuntimeError("boom")

    class PassingRule:
        rule_id = "PASSING_RULE"
        severity = "LOW"

        def check(self, context: ScanContext) -> list[Finding]:
            return [
                Finding(
                    rule_id=self.rule_id,
                    source="custom-rule",
                    severity=self.severity,
                    file="test.yml",
                    line=None,
                    title="Passing rule",
                    masked_evidence="test=***MASKED***",
                )
            ]

    engine = RuleEngine([FailingRule(), PassingRule()])
    findings = engine.run(_ctx())

    assert len(findings) == 1
    assert findings[0].id == "FND-0001"
    assert engine.warnings == ["Rule BROKEN_RULE failed: boom"]


def test_rule_engine_excludes_configured_rule_ids():
    yaml = """
services:
  app:
    image: myapp:latest
    privileged: true
"""
    engine = RuleEngine(excluded_rule_ids=["COMPOSE_LATEST_TAG"])

    findings = engine.run(_ctx({"default": yaml}))

    assert findings
    assert all(f.rule_id != "COMPOSE_LATEST_TAG" for f in findings)
    assert any(f.rule_id == "COMPOSE_PRIVILEGED_MODE" for f in findings)
