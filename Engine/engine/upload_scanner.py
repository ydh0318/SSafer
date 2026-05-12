from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ssafer.core.compose import ComposeSet
from ssafer.core.constants import MASK
from ssafer.core.hashing import hash_file
from ssafer.core.sanitize import sanitize_url_credentials
from ssafer.core.trivy import run_trivy_config
from ssafer.rules.base import Finding
from ssafer.rules.engine import RuleEngine, ScanContext

_AWS_KEY_RE = re.compile(r"AKIA[0-9A-Z]{16}")
_PRIVATE_KEY_RE = re.compile(
    r"-----BEGIN\s(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
)
_MAX_EVIDENCE_LEN = 120
_TEXT_SAMPLE_BYTES = 4096

_NO_PATCH_RULE_IDS = frozenset({
    "COMPOSE_HARDCODED_SECRET",
    "ENV_PLAIN_SECRET",
})


def scan_uploaded_files(file_paths: list[Path], temp_dir: Path) -> dict[str, Any]:
    env_files: list[Path] = []
    compose_files: list[Path] = []
    dockerfiles: list[Path] = []

    for fp in file_paths:
        name = fp.name
        if _is_env_file(name) or _looks_like_env_file(fp):
            env_files.append(fp)
        elif _is_compose_file(name) or _looks_like_compose_file(fp):
            compose_files.append(fp)
        elif _is_dockerfile(name):
            dockerfiles.append(fp)

    findings: list[Finding] = []
    warnings: list[str] = []

    custom_findings, custom_warnings = _run_custom_rules(
        compose_files, env_files, temp_dir,
    )
    findings.extend(custom_findings)
    warnings.extend(custom_warnings)

    trivy_findings, trivy_warnings = _run_trivy(dockerfiles, temp_dir)
    findings.extend(trivy_findings)
    warnings.extend(trivy_warnings)

    for f in findings:
        if f.rule_id in _NO_PATCH_RULE_IDS or "SECRET" in f.rule_id:
            f.patch_context = None

    for idx, f in enumerate(findings, start=1):
        f.id = f"FND-{idx:04d}"

    all_files = [*env_files, *compose_files, *dockerfiles]
    source_file_hashes = _build_source_file_hashes(all_files, temp_dir)

    return {
        "findings": [f.to_dict() for f in findings],
        "warnings": warnings,
        "sourceFileHashes": source_file_hashes,
        "targets": {
            "envFiles": [f.name for f in env_files],
            "dockerfiles": [f.name for f in dockerfiles],
            "composeFiles": [f.name for f in compose_files],
        },
        "summary": {
            "customRuleFindings": sum(1 for f in findings if f.source == "custom-rule"),
            "trivyFindings": sum(1 for f in findings if f.source == "trivy"),
            "totalFindings": len(findings),
            "warnings": len(warnings),
        },
    }


def _run_custom_rules(
    compose_files: list[Path],
    env_files: list[Path],
    project_root: Path,
) -> tuple[list[Finding], list[str]]:
    effective_configs: dict[str, str] = {}
    compose_sets: list[ComposeSet] = []
    for cf in compose_files:
        try:
            raw = cf.read_text(encoding="utf-8")
        except OSError:
            continue
        effective_configs[cf.name] = raw
        compose_sets.append(ComposeSet(
            name=cf.name,
            directory=cf.parent,
            files=[cf],
            env_files=[ef for ef in env_files if ef.parent == cf.parent],
        ))

    context = ScanContext(
        compose_sets=compose_sets,
        effective_configs=effective_configs,
        env_files=env_files,
        project_root=project_root,
    )

    engine = RuleEngine()
    findings = engine.run(context)

    for f in findings:
        if not f.file_path:
            f.file_path = f.file
        if not f.target_files and compose_files:
            f.target_files = [cf.name for cf in compose_files]

    return findings, engine.warnings


def _run_trivy(
    dockerfiles: list[Path],
    temp_dir: Path,
) -> tuple[list[Finding], list[str]]:
    findings: list[Finding] = []
    warnings: list[str] = []

    for dockerfile in dockerfiles:
        output_path = temp_dir / f".trivy-{dockerfile.name}.json"
        success, _, warning = run_trivy_config(dockerfile, output_path)

        if not success:
            if warning:
                warnings.append(warning)
            continue

        try:
            data = json.loads(output_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            warnings.append(f"Failed to parse Trivy output for {dockerfile.name}: {exc}")
            continue

        file_hash = hash_file(dockerfile)
        findings.extend(_parse_trivy_results(data, dockerfile.name, file_hash))

    return findings, warnings


def _parse_trivy_results(data: dict[str, Any], target_file: str, file_hash: str) -> list[Finding]:
    findings: list[Finding] = []
    for result in data.get("Results", []):
        for misc in result.get("Misconfigurations", []) or []:
            evidence = _sanitize_evidence(misc.get("Message", ""))
            patch_ctx = _trivy_patch_context(misc, file_hash)
            findings.append(Finding(
                rule_id=misc.get("ID", "UNKNOWN"),
                source="trivy",
                severity=_normalize_severity(misc.get("Severity", "UNKNOWN")),
                file=target_file,
                line=_extract_start_line(misc),
                title=misc.get("Title", ""),
                masked_evidence=evidence,
                file_path=target_file,
                patch_context=patch_ctx,
            ))

        for vuln in result.get("Vulnerabilities", []) or []:
            evidence = _sanitize_evidence(vuln.get("Description", ""))
            findings.append(Finding(
                rule_id=vuln.get("VulnerabilityID", "UNKNOWN"),
                source="trivy",
                severity=_normalize_severity(vuln.get("Severity", "UNKNOWN")),
                file=target_file,
                line=None,
                title=vuln.get("Title", ""),
                masked_evidence=evidence,
                file_path=target_file,
            ))

        for secret in result.get("Secrets", []) or []:
            findings.append(Finding(
                rule_id=secret.get("RuleID", "UNKNOWN"),
                source="trivy",
                severity=_normalize_severity(secret.get("Severity", "UNKNOWN")),
                file=target_file,
                line=secret.get("StartLine"),
                title=secret.get("Title", ""),
                masked_evidence=MASK,
                file_path=target_file,
            ))

    return findings


def _trivy_patch_context(misc: dict[str, Any], file_hash: str) -> dict | None:
    cause = misc.get("CauseMetadata")
    if not isinstance(cause, dict):
        return None
    start_line = cause.get("StartLine")
    end_line = cause.get("EndLine")
    if not isinstance(start_line, int) or start_line <= 0:
        return None

    code = cause.get("Code") or {}
    lines = code.get("Lines") or []
    cause_lines = [ln.get("Content", "") for ln in lines if ln.get("IsCause")]
    if not cause_lines:
        return None

    return {
        "type": "dockerfile",
        "target": cause.get("Service") or "",
        "lineStart": start_line,
        "lineEnd": end_line or start_line,
        "oldText": "\n".join(cause_lines),
        "expectedFileHash": file_hash,
    }


def _build_source_file_hashes(files: list[Path], base_dir: Path) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for f in files:
        try:
            hashes[f.name] = hash_file(f)
        except OSError:
            pass
    return hashes


def _sanitize_evidence(text: str) -> str:
    if not text:
        return ""
    text = sanitize_url_credentials(text)
    text = _AWS_KEY_RE.sub("AKIA****MASKED****", text)
    if _PRIVATE_KEY_RE.search(text):
        text = "[PRIVATE KEY REDACTED]"
    return text[:_MAX_EVIDENCE_LEN]


def _normalize_severity(severity: str) -> str:
    s = severity.upper()
    if s in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
        return s
    return "UNKNOWN"


def _extract_start_line(item: dict[str, Any]) -> int | None:
    cause = item.get("CauseMetadata")
    if isinstance(cause, dict):
        start_line = cause.get("StartLine")
        if isinstance(start_line, int) and start_line > 0:
            return start_line
    return None


def _is_env_file(name: str) -> bool:
    lower = name.lower()
    return lower == ".env" or lower.startswith(".env.") or lower.endswith(".env")


def _is_compose_file(name: str) -> bool:
    lower = name.lower()
    return (
        lower.startswith("docker-compose")
        or lower.startswith("compose")
        or lower.endswith(".compose.yml")
        or lower.endswith(".compose.yaml")
    )


def _is_dockerfile(name: str) -> bool:
    lower = name.lower()
    return lower == "dockerfile" or lower == "containerfile" or lower.startswith("dockerfile.")


def _looks_like_env_file(path: Path) -> bool:
    try:
        sample = path.read_text(encoding="utf-8")[:_TEXT_SAMPLE_BYTES]
    except (OSError, UnicodeDecodeError):
        return False

    meaningful_lines = [
        line.strip()
        for line in sample.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not meaningful_lines:
        return False

    assignment_lines = [
        line for line in meaningful_lines
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*=", line)
    ]
    return len(assignment_lines) >= max(1, len(meaningful_lines) // 2)


def _looks_like_compose_file(path: Path) -> bool:
    if path.suffix.lower() not in {".yml", ".yaml"}:
        return False
    try:
        sample = path.read_text(encoding="utf-8")[:_TEXT_SAMPLE_BYTES]
    except (OSError, UnicodeDecodeError):
        return False
    return "services:" in sample
