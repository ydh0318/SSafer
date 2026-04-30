from __future__ import annotations

import re
from typing import Any

import yaml

from ssafer.core.constants import DB_PORTS
from ssafer.core.sanitize import is_placeholder, is_safe_key, is_secret_key, make_masked_evidence
from ssafer.rules.base import BaseRule, Finding
from ssafer.rules.engine import ScanContext

_ENV_REF_RE = re.compile(r"^\$\{[^}]+\}$")


def _is_env_ref(value: str) -> bool:
    return bool(_ENV_REF_RE.match(str(value).strip()))


def _parse_effective_yaml(raw_yaml: str) -> dict[str, Any]:
    try:
        return yaml.safe_load(raw_yaml) or {}
    except yaml.YAMLError:
        return {}


def _services(doc: dict[str, Any]) -> dict[str, Any]:
    return doc.get("services") or {}


class ComposeExposedDbPortRule(BaseRule):
    rule_id = "COMPOSE_EXPOSED_DB_PORT"
    severity = "CRITICAL"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for set_name, raw_yaml in context.effective_configs.items():
            doc = _parse_effective_yaml(raw_yaml)
            for svc_name, svc in _services(doc).items():
                for port_entry in svc.get("ports") or []:
                    port_mapping = self._extract_port_mapping(port_entry)
                    if port_mapping is None:
                        continue
                    host_port, container_port = port_mapping
                    if host_port and host_port in DB_PORTS:
                        findings.append(Finding(
                            rule_id=self.rule_id,
                            source="custom-rule",
                            severity=self.severity,
                            file=f"docker-compose ({set_name})",
                            line=None,
                            title=f"DB 포트({host_port})가 호스트에 노출됨",
                            masked_evidence=make_masked_evidence(
                                f"services.{svc_name}.ports", f"{host_port}:{container_port}"
                            ),
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
        for set_name, raw_yaml in context.effective_configs.items():
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
                    ):
                        findings.append(Finding(
                            rule_id=self.rule_id,
                            source="custom-rule",
                            severity=self.severity,
                            file=f"docker-compose ({set_name})",
                            line=None,
                            title=f"서비스 '{svc_name}'에 민감한 환경변수가 설정됨",
                            masked_evidence=make_masked_evidence(
                                f"services.{svc_name}.environment.{key}"
                            ),
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
