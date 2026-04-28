from __future__ import annotations

from pathlib import Path

from ssafer.core.env_parser import normalize_env_key
from ssafer.core.sanitize import is_placeholder, is_safe_key, is_secret_key, make_masked_evidence
from ssafer.rules.base import BaseRule, Finding
from ssafer.rules.engine import ScanContext


def _strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] in ('"', "'") and value[0] == value[-1]:
        return value[1:-1]
    return value


class EnvPlainSecretRule(BaseRule):
    rule_id = "ENV_PLAIN_SECRET"
    severity = "HIGH"

    def check(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        for env_file in context.env_files:
            findings.extend(self._check_file(env_file, context.project_root))
        return findings

    def _check_file(self, env_file: Path, project_root: Path) -> list[Finding]:
        findings: list[Finding] = []
        try:
            lines = env_file.read_text(encoding="utf-8-sig", errors="replace").splitlines()
        except OSError:
            return findings

        rel_path = str(env_file.relative_to(project_root))

        for lineno, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" not in stripped:
                continue
            key, raw_value = stripped.split("=", 1)
            key = normalize_env_key(key)
            value = _strip_quotes(raw_value)

            if (
                is_secret_key(key)
                and not is_safe_key(key)
                and value
                and not is_placeholder(value)
            ):
                findings.append(Finding(
                    rule_id=self.rule_id,
                    source="custom-rule",
                    severity=self.severity,
                    file=rel_path,
                    line=lineno,
                    title=f"환경변수 파일에 시크릿이 하드코딩됨: {key}",
                    masked_evidence=make_masked_evidence(key),
                ))
        return findings
