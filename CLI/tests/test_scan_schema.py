from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

import pytest

import ssafer.core.result_store as result_store
from security_samples import AWS_ACCESS_KEY, MASKED_VALUE, trivy_secret_result
from ssafer.core.result_store import _normalize_trivy_findings, backend_finding_source_type, load_last_scan
from ssafer.core.trivy import sanitize_trivy_json


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
ISO8601_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
FINDING_SCHEMA_KEYS = {
    "id",
    "ruleId",
    "source",
    "severity",
    "file",
    "line",
    "title",
    "maskedEvidence",
}
OPTIONAL_FINDING_SCHEMA_KEYS = {
    "filePath",
    "targetFiles",
    "patchContext",
}


def _write_scan(project_root: Path, scan: dict[str, Any]) -> None:
    results_dir = project_root / ".ssafer" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    scan_file = results_dir / "test-scan.json"
    scan_file.write_text(json.dumps(scan), encoding="utf-8")
    (results_dir / "last_scan.txt").write_text(scan_file.name, encoding="utf-8")


def _minimal_scan(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "schemaVersion": "0.1",
        "scanId": str(uuid.uuid4()),
        "source": "cli",
        "scannedAt": "2026-04-24T12:00:00Z",
        "findings": [],
    }
    base.update(overrides)
    return base


# ── 스키마 필드 검증 ──────────────────────────────────────────────────────────

def test_schema_version_is_0_1(tmp_path: Path):
    scan = _minimal_scan()
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    assert loaded["schemaVersion"] == "0.1"


def test_scan_id_is_valid_uuid_v4(tmp_path: Path):
    scan = _minimal_scan()
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    assert UUID_RE.match(loaded["scanId"]), f"scanId is not UUID v4: {loaded['scanId']}"


def test_source_is_cli(tmp_path: Path):
    scan = _minimal_scan()
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    assert loaded["source"] == "cli"


def test_scanned_at_is_iso8601(tmp_path: Path):
    scan = _minimal_scan()
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    assert ISO8601_RE.match(loaded["scannedAt"]), f"scannedAt format wrong: {loaded['scannedAt']}"


def test_rule_engine_warning_makes_scan_partial(tmp_path: Path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("PUBLIC_MODE=dev\n", encoding="utf-8")

    class FakeRuleEngine:
        warnings = ["Rule BROKEN_RULE failed: boom"]

        def __init__(self, excluded_rule_ids: list[str] | None = None):
            pass

        def run(self, context: Any) -> list:
            return []

    monkeypatch.setattr(result_store, "RuleEngine", FakeRuleEngine)

    scan = result_store.run_scan(tmp_path)

    assert scan["analysisStatus"] == "PARTIAL"
    assert scan["warnings"] == ["Rule BROKEN_RULE failed: boom"]
    assert scan["cliSummary"]["warnings"] == 1


def test_project_config_name_is_written_to_scan_result(tmp_path: Path, monkeypatch):
    (tmp_path / "ssafer.yml").write_text("project_name: my-app\n", encoding="utf-8")
    monkeypatch.setattr(result_store, "trivy_version", lambda: None)
    monkeypatch.setattr(result_store, "_docker_compose_version", lambda: None)

    scan = result_store.run_scan(tmp_path)

    assert scan["projectName"] == "my-app"


def test_invalid_project_config_is_recorded_as_scan_warning(tmp_path: Path, monkeypatch):
    (tmp_path / "ssafer.yml").write_text("upload: [", encoding="utf-8")
    monkeypatch.setattr(result_store, "trivy_version", lambda: None)
    monkeypatch.setattr(result_store, "_docker_compose_version", lambda: None)

    scan = result_store.run_scan(tmp_path)

    assert any("Failed to parse ssafer.yml" in warning for warning in scan["warnings"])
    assert scan["cliSummary"]["warnings"] == len(scan["warnings"])


def test_project_config_rule_excludes_are_passed_to_rule_engine(tmp_path: Path, monkeypatch):
    (tmp_path / "ssafer.yml").write_text(
        """
rules:
  exclude:
    - DOCKER_LATEST_TAG
""",
        encoding="utf-8",
    )
    captured: dict[str, Any] = {}

    class FakeRuleEngine:
        warnings: list[str] = []

        def __init__(self, excluded_rule_ids: list[str] | None = None):
            captured["excluded_rule_ids"] = excluded_rule_ids

        def run(self, context: Any) -> list:
            return []

    monkeypatch.setattr(result_store, "RuleEngine", FakeRuleEngine)
    monkeypatch.setattr(result_store, "trivy_version", lambda: None)
    monkeypatch.setattr(result_store, "_docker_compose_version", lambda: None)

    result_store.run_scan(tmp_path)

    assert captured["excluded_rule_ids"] == ["DOCKER_LATEST_TAG"]


def test_invalid_extra_masking_regex_is_recorded_as_scan_warning(tmp_path: Path, monkeypatch):
    (tmp_path / "ssafer.yml").write_text(
        """
masking:
  extra_patterns:
    - name: broken
      regex: "("
      mask: "[REDACTED]"
""",
        encoding="utf-8",
    )
    monkeypatch.setattr(result_store, "trivy_version", lambda: None)
    monkeypatch.setattr(result_store, "_docker_compose_version", lambda: None)

    scan = result_store.run_scan(tmp_path)

    assert any("Invalid masking.extra_patterns regex 'broken'" in warning for warning in scan["warnings"])


# ── findings 구조 검증 ────────────────────────────────────────────────────────

def test_findings_source_never_ai(tmp_path: Path):
    scan = _minimal_scan(findings=[
        {"id": "FND-0001", "ruleId": "TEST", "source": "custom-rule",
         "severity": "HIGH", "file": "test", "line": None,
         "title": "test", "maskedEvidence": "test=***MASKED***"},
    ])
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    for finding in loaded["findings"]:
        assert finding["source"] != "ai"


def test_finding_sources_map_to_backend_source_types():
    assert backend_finding_source_type("trivy") == "TRIVY"
    assert backend_finding_source_type("custom-rule") == "CUSTOM_RULE"


def test_ai_finding_source_is_not_mapped_to_backend():
    with pytest.raises(ValueError, match="Unsupported finding source"):
        backend_finding_source_type("ai")


def test_findings_share_common_schema_for_cli_backend_and_frontend():
    custom_finding = {
        "id": "FND-0001",
        "ruleId": "ENV_PLAIN_SECRET",
        "source": "custom-rule",
        "severity": "HIGH",
        "file": ".env",
        "line": 1,
        "title": "Plain secret in env file",
        "maskedEvidence": "DB_PASSWORD=***MASKED***",
    }
    trivy_finding = _normalize_trivy_findings([
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Misconfigurations": [
                            {
                                "ID": "DS001",
                                "Title": "Test misconfig",
                                "Severity": "HIGH",
                                "Message": "some message",
                            }
                        ],
                    }
                ]
            },
        }
    ], 1)[0]

    for finding in [custom_finding, trivy_finding]:
        assert FINDING_SCHEMA_KEYS <= set(finding)
        assert set(finding) <= FINDING_SCHEMA_KEYS | OPTIONAL_FINDING_SCHEMA_KEYS
        assert finding["source"] in {"trivy", "custom-rule"}
        assert backend_finding_source_type(finding["source"]) in {"TRIVY", "CUSTOM_RULE"}
        assert isinstance(finding["ruleId"], str) and finding["ruleId"]
        assert isinstance(finding["severity"], str) and finding["severity"]
        assert isinstance(finding["file"], str) and finding["file"]
        assert finding["line"] is None or isinstance(finding["line"], int)
        assert isinstance(finding["title"], str) and finding["title"]
        assert isinstance(finding["maskedEvidence"], str)


def test_findings_id_format_fnd_xxxx(tmp_path: Path):
    scan = _minimal_scan(findings=[
        {"id": "FND-0001", "ruleId": "TEST", "source": "trivy",
         "severity": "HIGH", "file": "Dockerfile", "line": None,
         "title": "test", "maskedEvidence": ""},
    ])
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    for finding in loaded["findings"]:
        assert re.match(r"^FND-\d{4}$", finding["id"]), f"Bad id: {finding['id']}"


def test_findings_masked_evidence_max_120_chars(tmp_path: Path):
    long_evidence = "K" * 200
    scan = _minimal_scan(findings=[
        {"id": "FND-0001", "ruleId": "TEST", "source": "custom-rule",
         "severity": "LOW", "file": "test", "line": None,
         "title": "test", "maskedEvidence": long_evidence[:120]},
    ])
    _write_scan(tmp_path, scan)
    loaded = load_last_scan(tmp_path)
    assert loaded is not None
    for finding in loaded["findings"]:
        assert len(finding["maskedEvidence"]) <= 120


# ── Trivy findings 정규화 테스트 ──────────────────────────────────────────────

def test_trivy_findings_normalized_to_schema():
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Misconfigurations": [
                            {
                                "ID": "DS001",
                                "Title": "Test misconfig",
                                "Severity": "HIGH",
                                "Message": "some message",
                            }
                        ],
                    }
                ]
            },
        }
    ]
    findings = _normalize_trivy_findings(artifacts, 0)
    assert len(findings) == 1
    assert findings[0]["source"] == "trivy"
    assert findings[0]["ruleId"] == "DS001"
    assert findings[0]["severity"] == "HIGH"
    assert findings[0]["id"] == "FND-0001"


def test_trivy_misconfiguration_fields_map_from_raw_json():
    raw_misconfiguration = {
        "ID": "DS-0002",
        "Title": "Image user should not be 'root'",
        "Severity": "HIGH",
        "Message": "Last USER command in Dockerfile should not be 'root'",
        "CauseMetadata": {
            "StartLine": 2,
            "Code": {
                "Lines": [
                    {
                        "Number": 2,
                        "Content": "USER root",
                    }
                ]
            },
        },
    }
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Misconfigurations": [raw_misconfiguration],
                    }
                ]
            },
        }
    ]

    finding = _normalize_trivy_findings(artifacts, 0)[0]

    assert FINDING_SCHEMA_KEYS <= set(finding)
    assert set(finding) <= FINDING_SCHEMA_KEYS | OPTIONAL_FINDING_SCHEMA_KEYS
    assert finding["id"] == "FND-0001"
    assert re.match(r"^FND-\d{4}$", finding["id"])
    assert finding["ruleId"] == raw_misconfiguration["ID"]
    assert finding["source"] == "trivy"
    assert backend_finding_source_type(finding["source"]) == "TRIVY"
    assert finding["severity"] == raw_misconfiguration["Severity"]
    assert finding["file"] == "Dockerfile"
    assert finding["filePath"] == "Dockerfile"
    assert finding["line"] == raw_misconfiguration["CauseMetadata"]["StartLine"]
    assert finding["title"] == raw_misconfiguration["Title"]
    assert len(finding["title"]) <= 255
    assert finding["maskedEvidence"] == raw_misconfiguration["Message"]
    assert len(finding["maskedEvidence"]) <= 120
    assert finding["patchContext"] == {
        "type": "dockerfile",
        "target": "DS-0002",
        "lineStart": 2,
        "lineEnd": 2,
        "oldText": "USER root",
    }


def test_trivy_findings_vulnerabilities_normalized():
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Vulnerabilities": [
                            {
                                "VulnerabilityID": "CVE-2024-1234",
                                "Title": "Some CVE",
                                "Severity": "CRITICAL",
                                "Description": "A serious vulnerability",
                            }
                        ],
                    }
                ]
            },
        }
    ]
    findings = _normalize_trivy_findings(artifacts, 0)
    assert len(findings) == 1
    assert findings[0]["source"] == "trivy"
    assert findings[0]["ruleId"] == "CVE-2024-1234"
    assert findings[0]["severity"] == "CRITICAL"


def test_trivy_findings_start_index_offset():
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Misconfigurations": [
                            {"ID": "DS001", "Title": "T1", "Severity": "LOW", "Message": ""},
                            {"ID": "DS002", "Title": "T2", "Severity": "LOW", "Message": ""},
                        ],
                    }
                ]
            },
        }
    ]
    findings = _normalize_trivy_findings(artifacts, 3)
    assert findings[0]["id"] == "FND-0004"
    assert findings[1]["id"] == "FND-0005"


def test_trivy_masked_evidence_max_120_chars():
    long_msg = "X" * 200
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Misconfigurations": [
                            {"ID": "DS001", "Title": "T", "Severity": "LOW", "Message": long_msg},
                        ],
                    }
                ]
            },
        }
    ]
    findings = _normalize_trivy_findings(artifacts, 0)
    assert len(findings[0]["maskedEvidence"]) <= 120


def test_trivy_secret_finding_uses_sanitized_match():
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": {
                "Results": [
                    {
                        "Target": "Dockerfile",
                        "Secrets": [
                            {
                                "RuleID": "aws-access-key-id",
                                "Title": "AWS Access Key",
                                "Severity": "HIGH",
                                "StartLine": 4,
                                "Match": "***MASKED***",
                            }
                        ],
                    }
                ]
            },
        }
    ]

    finding = _normalize_trivy_findings(artifacts, 0)[0]

    assert finding["ruleId"] == "aws-access-key-id"
    assert finding["source"] == "trivy"
    assert finding["line"] == 4
    assert finding["maskedEvidence"] == "***MASKED***"


def test_trivy_secret_scan_shape_does_not_keep_raw_secret():
    content = sanitize_trivy_json(trivy_secret_result(AWS_ACCESS_KEY))
    artifacts = [
        {
            "type": "trivy-json",
            "target": "Dockerfile",
            "hash": "sha256:abc",
            "content": content,
        }
    ]
    findings = _normalize_trivy_findings(artifacts, 0)
    scan = _minimal_scan(findings=findings, artifacts=artifacts)
    serialized = json.dumps(scan, ensure_ascii=False)

    assert AWS_ACCESS_KEY not in serialized
    assert scan["artifacts"][0]["content"]["Results"][0]["Secrets"][0]["Match"] == MASKED_VALUE
    assert scan["findings"][0]["maskedEvidence"] == MASKED_VALUE


def test_non_trivy_artifacts_ignored():
    artifacts = [
        {"type": "env-metadata", "target": ".env", "hash": "sha256:abc", "content": {}},
        {"type": "sanitized-effective-compose", "composeSet": "default", "hash": "sha256:def", "content": ""},
    ]
    findings = _normalize_trivy_findings(artifacts, 0)
    assert findings == []
