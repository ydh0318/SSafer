from __future__ import annotations

import json
import platform
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ssafer import __version__
from ssafer.core.compose import build_compose_sets, detect_environment_from_compose_sets, render_effective_config
from ssafer.core.config import load_project_config
from ssafer.core.env_parser import parse_env_metadata
from ssafer.core.finder import discover_project_files
from ssafer.core.hashing import hash_file, hash_text, load_or_create_project_salt
from ssafer.core.sanitize import compile_extra_masking_patterns, sanitize_compose_yaml
from ssafer.core.trivy import run_trivy_config, sanitize_trivy_json, trivy_version
from ssafer.rules.engine import RuleEngine, ScanContext

BACKEND_FINDING_SOURCE_TYPES = {
    "trivy": "TRIVY",
    "custom-rule": "CUSTOM_RULE",
}


def run_scan(
    project_root: Path,
    save_raw: bool = False,
    on_step: Callable[[str], None] | None = None,
    environment: str | None = None,
) -> dict[str, Any]:
    def _step(msg: str) -> None:
        if on_step:
            on_step(msg)

    warnings: list[str] = []
    project_root = project_root.resolve()
    _step("프로젝트 설정을 읽는 중...")
    project_config = load_project_config(project_root, warnings)
    extra_masking_patterns = compile_extra_masking_patterns(project_config.masking.extra_patterns, warnings)
    _step("스캔 대상 파일을 찾는 중...")
    files = discover_project_files(project_root)
    _step(
        "스캔 대상 확인 완료: "
        f".env {len(files.env_files)}개, "
        f"Compose {len(files.compose_files)}개, "
        f"Dockerfile {len(files.dockerfiles)}개"
    )
    salt = load_or_create_project_salt(project_root)

    scan_id = str(uuid.uuid4())
    scanned_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ssafer_dir = project_root / ".ssafer"
    sanitized_dir = ssafer_dir / "effective" / "sanitized"
    raw_dir = ssafer_dir / "effective" / "raw"
    trivy_dir = ssafer_dir / "trivy"
    results_dir = ssafer_dir / "results"
    sanitized_dir.mkdir(parents=True, exist_ok=True)
    trivy_dir.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)
    if save_raw:
        raw_dir.mkdir(parents=True, exist_ok=True)

    artifacts: list[dict[str, Any]] = []
    _step("대상 파일 해시를 계산하는 중...")
    source_hashes = _source_hashes(project_root, [*files.env_files, *files.dockerfiles, *files.compose_files], warnings)
    effective_hashes: dict[str, str] = {}
    _step("Compose 세트를 구성하는 중...")
    compose_sets = build_compose_sets(files.compose_files, warnings)
    _step(f"Compose 세트 {len(compose_sets)}개 확인")

    for compose_set in compose_sets:
        _step(f"Compose 설정을 렌더링하는 중: {compose_set.name}")
        ok, raw_config, error, compose_warning = render_effective_config(compose_set)
        if not ok:
            warnings.append(error or f"Failed to render compose set '{compose_set.name}'.")
            continue
        if compose_warning:
            warnings.append(_compose_warning_with_context(compose_set, project_root, compose_warning))

        _step(f"민감정보를 마스킹하는 중: {compose_set.name}")
        sanitized = sanitize_compose_yaml(raw_config, extra_patterns=extra_masking_patterns)
        safe_name = _safe_artifact_name(compose_set.name)
        sanitized_path = sanitized_dir / f"{safe_name}.compose.yml"
        sanitized_path.write_text(sanitized, encoding="utf-8")
        effective_hashes[compose_set.name] = hash_text(sanitized)
        if save_raw:
            (raw_dir / f"{safe_name}.compose.yml").write_text(raw_config, encoding="utf-8")

        artifacts.append(
            {
                "type": "sanitized-effective-compose",
                "composeSet": compose_set.name,
                "hash": effective_hashes[compose_set.name],
                "content": sanitized,
            }
        )

    _step("커스텀 보안 룰을 검사하는 중...")
    effective_configs = {
        a["composeSet"]: a["content"]
        for a in artifacts
        if a["type"] == "sanitized-effective-compose"
    }
    resolved_env = environment or detect_environment_from_compose_sets(compose_sets, effective_configs)
    scan_context = ScanContext(
        compose_sets=compose_sets,
        effective_configs=effective_configs,
        env_files=files.env_files,
        project_root=project_root,
        environment=resolved_env,
    )
    rule_engine = RuleEngine(excluded_rule_ids=project_config.rules.exclude)
    custom_rule_findings = rule_engine.run(scan_context)
    warnings.extend(rule_engine.warnings)

    _step(f"환경변수 파일 {len(files.env_files)}개를 파싱하는 중...")
    env_metadata = parse_env_metadata(files.env_files, salt, project_root, warnings)
    for env_item in env_metadata:
        artifacts.append(
            {
                "type": "env-metadata",
                "target": env_item["path"],
                "hash": hash_text(json.dumps(env_item, sort_keys=True)),
                "content": env_item,
            }
        )

    trivy_findings = 0
    trivy_version_value = trivy_version()
    for dockerfile in files.dockerfiles:
        _step(f"Trivy로 Dockerfile을 검사하는 중: {dockerfile.relative_to(project_root)}")
        output_path = trivy_dir / f"{_safe_artifact_name(str(dockerfile.relative_to(project_root)))}.json"
        ok, count, error = run_trivy_config(dockerfile, output_path)
        if not ok:
            warnings.append(error or f"Trivy failed for {dockerfile}.")
            continue
        trivy_findings += count
        try:
            raw_content = json.loads(output_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raw_content = {}
        content = sanitize_trivy_json(raw_content)
        artifacts.append(
            {
                "type": "trivy-json",
                "target": str(dockerfile.relative_to(project_root)),
                "hash": hash_text(json.dumps(content, sort_keys=True, ensure_ascii=False)),
                "content": content,
            }
        )

    _step("발견 항목을 정리하는 중...")
    custom_findings_dicts = [f.to_dict() for f in custom_rule_findings]
    trivy_findings_dicts = _normalize_trivy_findings(artifacts, len(custom_findings_dicts), source_hashes)
    findings = custom_findings_dicts + trivy_findings_dicts

    status = _analysis_status(artifacts, warnings)
    result = {
        "schemaVersion": "0.1",
        "scanId": scan_id,
        "projectName": project_config.project_name,
        "source": "cli",
        "environment": resolved_env,
        "scannedAt": scanned_at,
        "toolVersion": __version__,
        "os": platform.system().lower(),
        "analysisStatus": status,
        "toolVersions": {
            "trivy": trivy_version_value,
            "dockerCompose": _docker_compose_version(),
        },
        "warnings": warnings,
        "findings": findings,
        "sourceFileHashes": source_hashes,
        "effectiveConfigHashes": effective_hashes,
        "targets": {
            "envFiles": [str(path.relative_to(project_root)) for path in files.env_files],
            "dockerfiles": [str(path.relative_to(project_root)) for path in files.dockerfiles],
            "composeSets": [_compose_set_manifest(item, project_root) for item in compose_sets],
        },
        "artifacts": artifacts,
        "cliSummary": {
            "composeSets": len(compose_sets),
            "envFiles": len(files.env_files),
            "dockerfiles": len(files.dockerfiles),
            "trivyFindings": trivy_findings,
            "customRuleFindings": len(custom_rule_findings),
            "totalFindings": len(findings),
            "warnings": len(warnings),
        },
        "analysisSummary": None,
    }

    _step("스캔 결과 JSON을 저장하는 중...")
    result_path = results_dir / f"{scan_id}.json"
    result_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    (results_dir / "last_scan.txt").write_text(result_path.name, encoding="utf-8")
    return result


def load_last_scan(project_root: Path) -> dict[str, Any] | None:
    results_dir = project_root / ".ssafer" / "results"
    marker = results_dir / "last_scan.txt"
    if marker.exists():
        scan_path = results_dir / marker.read_text(encoding="utf-8").strip()
    else:
        candidates = sorted(
            p for p in (results_dir.glob("*.json") if results_dir.exists() else [])
            if p.name != "last_scan.txt"
        )
        scan_path = candidates[-1] if candidates else None
    if not scan_path or not scan_path.exists():
        return None
    return json.loads(scan_path.read_text(encoding="utf-8"))


def _source_hashes(root: Path, paths: list[Path], warnings: list[str]) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for path in paths:
        try:
            hashes[str(path.relative_to(root))] = hash_file(path)
        except OSError as exc:
            warnings.append(f"Failed to hash {path}: {exc}")
    return hashes


def _compose_warning_with_context(compose_set: Any, root: Path, message: str) -> str:
    files = ",".join(str(path.relative_to(root)) for path in compose_set.files)
    return f"[ssafer-compose name={compose_set.name} files={files}] {message}"


def _analysis_status(artifacts: list[dict[str, Any]], warnings: list[str]) -> str:
    if not artifacts:
        return "FAILED"
    if warnings:
        return "PARTIAL"
    return "SUCCESS"


def _compose_set_manifest(compose_set: Any, root: Path) -> dict[str, Any]:
    return {
        "name": compose_set.name,
        "files": [str(path.relative_to(root)) for path in compose_set.files],
        "envFiles": [str(path.relative_to(root)) for path in compose_set.env_files],
        "independent": compose_set.independent,
    }


def _safe_artifact_name(name: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in name)


def backend_finding_source_type(source: str) -> str:
    try:
        return BACKEND_FINDING_SOURCE_TYPES[source]
    except KeyError as exc:
        raise ValueError(f"Unsupported finding source for backend mapping: {source}") from exc


def _normalize_trivy_findings(
    artifacts: list[dict[str, Any]],
    start_index: int,
    source_hashes: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    idx = start_index
    for artifact in artifacts:
        if artifact.get("type") != "trivy-json":
            continue
        content = artifact.get("content") or {}
        target_file = artifact.get("target", "unknown")
        for result in content.get("Results") or []:
            file_target = result.get("Target") or target_file
            for misconf in result.get("Misconfigurations") or []:
                idx += 1
                finding = {
                    "id": f"FND-{idx:04d}",
                    "ruleId": misconf.get("ID", "UNKNOWN"),
                    "source": "trivy",
                    "severity": misconf.get("Severity", "UNKNOWN"),
                    "file": file_target,
                    "filePath": target_file,
                    "line": _trivy_misconfiguration_line(misconf),
                    "title": misconf.get("Title", ""),
                    "maskedEvidence": (misconf.get("Message") or "")[:120],
                }
                patch_context = _trivy_patch_context(misconf, target_file, source_hashes or {})
                if patch_context:
                    finding["patchContext"] = patch_context
                findings.append(finding)
            for vuln in result.get("Vulnerabilities") or []:
                idx += 1
                findings.append({
                    "id": f"FND-{idx:04d}",
                    "ruleId": vuln.get("VulnerabilityID", "UNKNOWN"),
                    "source": "trivy",
                    "severity": vuln.get("Severity", "UNKNOWN"),
                    "file": file_target,
                    "filePath": target_file,
                    "line": None,
                    "title": vuln.get("Title") or vuln.get("VulnerabilityID", ""),
                    "maskedEvidence": (vuln.get("Description") or "")[:120],
                })
            for secret in result.get("Secrets") or []:
                idx += 1
                findings.append({
                    "id": f"FND-{idx:04d}",
                    "ruleId": secret.get("RuleID", "UNKNOWN"),
                    "source": "trivy",
                    "severity": secret.get("Severity", "UNKNOWN"),
                    "file": file_target,
                    "filePath": target_file,
                    "line": secret.get("StartLine"),
                    "title": secret.get("Title", ""),
                    "maskedEvidence": (secret.get("Match") or "")[:120],
                })
    return findings


def _trivy_misconfiguration_line(misconfiguration: dict[str, Any]) -> int | None:
    line = (misconfiguration.get("CauseMetadata") or {}).get("StartLine")
    return line if isinstance(line, int) else None


def _trivy_patch_context(
    misconfiguration: dict[str, Any],
    target_file: str,
    source_hashes: dict[str, str],
) -> dict[str, Any] | None:
    cause_metadata = misconfiguration.get("CauseMetadata") or {}
    lines = ((cause_metadata.get("Code") or {}).get("Lines") or [])
    old_lines: list[str] = []
    line_numbers: list[int] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        content = line.get("Content")
        number = line.get("Number")
        if isinstance(content, str):
            old_lines.append(content)
        if isinstance(number, int):
            line_numbers.append(number)
    if not old_lines:
        return None
    context: dict[str, Any] = {
        "type": "dockerfile",
        "target": misconfiguration.get("ID", "UNKNOWN"),
        "operation": "replace",
        "lineStart": min(line_numbers) if line_numbers else _trivy_misconfiguration_line(misconfiguration),
        "lineEnd": max(line_numbers) if line_numbers else _trivy_misconfiguration_line(misconfiguration),
        "oldText": "\n".join(old_lines),
    }
    expected_hash = source_hashes.get(target_file)
    if expected_hash:
        context["expectedFileHash"] = expected_hash
    return context


def _docker_compose_version() -> str | None:
    from ssafer.core.doctor import _command_first_line

    return _command_first_line(["docker", "compose", "version"])
