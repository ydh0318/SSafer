from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from ssafer.core.constants import DB_PORTS
from ssafer.core.hashing import hash_file
from ssafer.core.sanitize import is_placeholder, is_safe_key, is_secret_key, make_masked_evidence
from ssafer.rules.base import BaseRule, Finding
from ssafer.rules.engine import ScanContext

_ENV_REF_RE = re.compile(r"^\$\{[^}]+\}$")
_LOCAL_DEFAULT_SECRET_VALUES = {
    "dev",
    "development",
    "guest",
    "local",
    "localhost",
    "password",
    "postgres",
    "rabbitmq",
    "redis",
    "sample",
    "ssafer",
    "test",
}


def _is_env_ref(value: str) -> bool:
    return bool(_ENV_REF_RE.match(str(value).strip()))


def _is_local_default_secret(value: str) -> bool:
    return str(value).strip().lower() in _LOCAL_DEFAULT_SECRET_VALUES


def _parse_effective_yaml(raw_yaml: str) -> dict[str, Any]:
    try:
        return yaml.safe_load(raw_yaml) or {}
    except yaml.YAMLError:
        return {}


def _services(doc: dict[str, Any]) -> dict[str, Any]:
    return doc.get("services") or {}


def _compose_file_refs(context: ScanContext, set_name: str) -> tuple[str | None, list[str]]:
    files: list[str] = []
    for compose_set in context.compose_sets:
        if compose_set.name != set_name:
            continue
        for compose_file in compose_set.files:
            try:
                files.append(str(compose_file.relative_to(context.project_root)))
            except ValueError:
                files.append(str(compose_file))
    unique_files = list(dict.fromkeys(files))
    file_path = unique_files[0] if len(unique_files) == 1 else None
    return file_path, unique_files


def _compose_files(context: ScanContext, set_name: str) -> list[Path]:
    for compose_set in context.compose_sets:
        if compose_set.name == set_name:
            return compose_set.files
    return []


def _relative_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _indent_width(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _yaml_key(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or stripped.startswith("-"):
        return None
    return stripped.split(":", 1)[0].strip().strip("'\"")


def _line_matches_key(line: str, key: str) -> bool:
    return _yaml_key(line) == key


def _find_service_line(lines: list[str], service_name: str) -> int | None:
    for index, line in enumerate(lines):
        if _line_matches_key(line, service_name):
            return index
    return None


def _find_key_in_block(lines: list[str], start: int, key: str) -> int | None:
    base_indent = _indent_width(lines[start])
    for index in range(start + 1, len(lines)):
        line = lines[index]
        if line.strip() and _indent_width(line) <= base_indent:
            break
        if _line_matches_key(line, key):
            return index
    return None


def _port_text_matches(line: str, host_port: int, container_port: int) -> bool:
    compact = line.replace("\"", "").replace("'", "").replace(" ", "")
    return f"{host_port}:{container_port}" in compact


def _find_port_patch_context(
    compose_file: Path,
    project_root: Path,
    service_name: str,
    host_port: int,
    container_port: int,
) -> dict | None:
    try:
        lines = compose_file.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    service_index = _find_service_line(lines, service_name)
    if service_index is None:
        return None
    ports_index = _find_key_in_block(lines, service_index, "ports")
    if ports_index is None:
        return None

    ports_indent = _indent_width(lines[ports_index])
    item_indices: list[int] = []
    matched_index: int | None = None
    for index in range(ports_index + 1, len(lines)):
        line = lines[index]
        if line.strip() and _indent_width(line) <= ports_indent:
            break
        if line.strip().startswith("-"):
            item_indices.append(index)
            if _port_text_matches(line, host_port, container_port):
                matched_index = index
    if matched_index is None:
        return None

    if len(item_indices) == 1:
        line_start = ports_index + 1
        line_end = item_indices[-1] + 1
        old_text = "\n".join(lines[ports_index:item_indices[-1] + 1])
    else:
        line_start = matched_index + 1
        line_end = matched_index + 1
        old_text = lines[matched_index]

    return {
        "type": "yaml",
        "target": f"services.{service_name}.ports",
        "lineStart": line_start,
        "lineEnd": line_end,
        "oldText": old_text,
        "expectedFileHash": hash_file(compose_file),
    }


def _unique_port_patch_target(
    compose_files: list[Path],
    project_root: Path,
    service_name: str,
    host_port: int,
    container_port: int,
) -> tuple[str | None, int | None, dict | None]:
    matches: list[tuple[Path, dict]] = []
    for compose_file in compose_files:
        patch_context = _find_port_patch_context(compose_file, project_root, service_name, host_port, container_port)
        if patch_context:
            matches.append((compose_file, patch_context))
    if len(matches) != 1:
        return None, None, None
    compose_file, patch_context = matches[0]
    return _relative_path(compose_file, project_root), patch_context["lineStart"], patch_context


class ComposeExposedDbPortRule(BaseRule):
    rule_id = "COMPOSE_EXPOSED_DB_PORT"
    severity = "CRITICAL"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            file_path, target_files = _compose_file_refs(context, set_name)
            compose_files = _compose_files(context, set_name)
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                for port_entry in svc.get("ports") or []:
                    port_mapping = self._extract_port_mapping(port_entry)
                    if port_mapping is None:
                        continue
                    host_port, container_port = port_mapping
                    if host_port and host_port in DB_PORTS:
                        patch_file_path, patch_line, patch_context = _unique_port_patch_target(
                            compose_files,
                            context.project_root,
                            svc_name,
                            host_port,
                            container_port,
                        )
                        findings.append(Finding(
                            rule_id=self.rule_id,
                            source="custom-rule",
                            severity=self.severity,
                            file=f"docker-compose ({set_name})",
                            line=patch_line,
                            title=f"DB 포트({host_port})가 호스트에 노출됨",
                            masked_evidence=make_masked_evidence(
                                f"services.{svc_name}.ports", f"{host_port}:{container_port}"
                            ),
                            file_path=patch_file_path or file_path,
                            target_files=target_files,
                            patch_context=patch_context,
                        ))
        return findings

    def _extract_port_mapping(self, port_entry: Any) -> tuple[int, int] | None:
        if isinstance(port_entry, int):
            return (port_entry, port_entry) if port_entry in DB_PORTS else None
        if isinstance(port_entry, str):
            parts = port_entry.split(":")
            try:
                if len(parts) >= 2:
                    return int(parts[-2]), int(parts[-1])
                return int(parts[0]), int(parts[0])
            except (ValueError, IndexError):
                return None
        if isinstance(port_entry, dict):
            published = port_entry.get("published")
            target = port_entry.get("target") or published
            try:
                return (int(published), int(target)) if published is not None else None
            except (ValueError, TypeError):
                return None
        return None


class ComposePrivilegedModeRule(BaseRule):
    rule_id = "COMPOSE_PRIVILEGED_MODE"
    severity = "HIGH"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                if svc.get("privileged") is True:
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=f"docker-compose ({set_name})",
                        line=None,
                        title=f"서비스 '{svc_name}'이 privileged 모드로 실행됨",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.privileged", "true"
                        ),
                    ))
        return findings


class ComposeHostNetworkRule(BaseRule):
    rule_id = "COMPOSE_HOST_NETWORK"
    severity = "HIGH"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                if svc.get("network_mode") == "host":
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=f"docker-compose ({set_name})",
                        line=None,
                        title=f"서비스 '{svc_name}'이 호스트 네트워크를 사용함",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.network_mode", "host"
                        ),
                    ))
        return findings


class ComposeHardcodedSecretRule(BaseRule):
    rule_id = "COMPOSE_HARDCODED_SECRET"
    severity = "HIGH"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        if not context.compose_sets:
            for set_name, raw_yaml in context.effective_configs.items():
                findings.extend(self._check_compose_yaml(raw_yaml, Path(f"docker-compose ({set_name})"), context.project_root))
            return findings
        seen_files: set[Path] = set()
        for compose_set in context.compose_sets:
            for compose_file in compose_set.files:
                if compose_file in seen_files:
                    continue
                seen_files.add(compose_file)
                try:
                    raw_yaml = compose_file.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                findings.extend(self._check_compose_yaml(raw_yaml, compose_file, context.project_root))
        return findings

    def _check_compose_yaml(self, raw_yaml: str, compose_file: Path, project_root: Path) -> list[Finding]:
        findings: list[Finding] = []
        try:
            rel_file = str(compose_file.relative_to(project_root))
        except ValueError:
            rel_file = str(compose_file)
        doc = _parse_effective_yaml(raw_yaml)
        for svc_name, svc in _services(doc).items():
            env = svc.get("environment") or {}
            items: list[tuple[str, str]] = []
            if isinstance(env, dict):
                items = [(str(k), str(v)) for k, v in env.items() if v is not None]
            elif isinstance(env, list):
                for entry in env:
                    if isinstance(entry, str) and "=" in entry:
                        k, v = entry.split("=", 1)
                        items.append((k, v))

            for key, value in items:
                if (
                    is_secret_key(key)
                    and not is_safe_key(key)
                    and value
                    and not _is_env_ref(value)
                    and not is_placeholder(value)
                    and not _is_local_default_secret(value)
                ):
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=rel_file,
                        line=None,
                        title=f"서비스 '{svc_name}'에 민감한 환경변수가 설정됨",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.environment.{key}"
                        ),
                        file_path=rel_file,
                    ))
        return findings


class ComposeLatestTagRule(BaseRule):
    rule_id = "COMPOSE_LATEST_TAG"
    severity = "MEDIUM"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                image = svc.get("image")
                if image is None:
                    continue
                image_str = str(image)
                if ":" not in image_str or image_str.endswith(":latest"):
                    tag = "latest" if image_str.endswith(":latest") else "(태그 없음)"
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=f"docker-compose ({set_name})",
                        line=None,
                        title=f"서비스 '{svc_name}'이 고정되지 않은 이미지 태그를 사용함",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.image", tag
                        ),
                    ))
        return findings


class ComposeRootUserRule(BaseRule):
    rule_id = "COMPOSE_ROOT_USER"
    severity = "MEDIUM"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                user = svc.get("user")
                if user is None:
                    continue
                user_str = str(user).strip().lower()
                if user_str in {"root", "0", "0:0"}:
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=f"docker-compose ({set_name})",
                        line=None,
                        title=f"서비스 '{svc_name}'이 root 사용자로 실행됨",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.user", "root"
                        ),
                    ))
        return findings


class ComposeNoMemoryLimitRule(BaseRule):
    rule_id = "COMPOSE_NO_MEMORY_LIMIT"
    severity = "LOW"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                deploy = svc.get("deploy") or {}
                if not deploy:
                    continue
                limits = (deploy.get("resources") or {}).get("limits") or {}
                if not limits.get("memory"):
                    findings.append(Finding(
                        rule_id=self.rule_id,
                        source="custom-rule",
                        severity=self.severity,
                        file=f"docker-compose ({set_name})",
                        line=None,
                        title=f"서비스 '{svc_name}'에 메모리 제한이 설정되지 않음",
                        masked_evidence=make_masked_evidence(
                            f"services.{svc_name}.deploy.resources.limits.memory", "(없음)"
                        ),
                    ))
        return findings
