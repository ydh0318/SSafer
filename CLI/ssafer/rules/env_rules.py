from __future__ import annotations

import subprocess
from pathlib import Path

from ssafer.core.env_parser import normalize_env_key
from ssafer.core.sanitize import (
    AWS_KEY_RE,
    PRIVATE_KEY_RE,
    classify_value,
    is_placeholder,
    is_safe_key,
    is_secret_key,
    make_masked_evidence,
)
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
        is_example_env = _is_example_env_file(env_file)
        git_state = _git_file_state(env_file, project_root)
        if not is_example_env and git_state == "ignored":
            return findings

        for lineno, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" not in stripped:
                continue
            key, raw_value = stripped.split("=", 1)
            key = normalize_env_key(key)
            value = _strip_quotes(raw_value)

            if _should_report_env_secret(key, value, is_example_env):
                findings.append(Finding(
                    rule_id=self.rule_id,
                    source="custom-rule",
                    severity=self._severity_for_env_file(is_example_env),
                    file=rel_path,
                    line=lineno,
                    title=self._title_for_env_file(is_example_env, key),
                    masked_evidence=make_masked_evidence(key),
                    file_path=rel_path,
                ))
        return findings

    def _severity_for_env_file(self, is_example_env: bool) -> str:
        if is_example_env:
            return "MEDIUM"
        return self.severity

    def _title_for_env_file(self, is_example_env: bool, key: str) -> str:
        if is_example_env:
            return f"환경변수 예시 파일에 실제 시크릿처럼 보이는 값이 있음: {key}"
        return f"Git에 추적 중인 환경변수 파일에 시크릿이 있음: {key}"


def _is_example_env_file(path: Path) -> bool:
    return path.name.endswith((".example", ".sample")) or path.name in {
        ".env.example",
        "env.example",
        ".env.sample",
        "env.sample",
    }


def _should_report_env_secret(key: str, value: str, is_example_env: bool) -> bool:
    if not is_secret_key(key) or is_safe_key(key) or not value:
        return False
    if is_placeholder(value) or _is_example_placeholder(value):
        return False
    if not is_example_env:
        return True
    return _looks_like_real_secret_value(value)


def _looks_like_real_secret_value(value: str) -> bool:
    stripped = value.strip()
    if AWS_KEY_RE.search(stripped) or PRIVATE_KEY_RE.search(stripped):
        return True
    return classify_value(stripped) == "secret-like" and _has_secret_entropy(stripped)


def _has_secret_entropy(value: str) -> bool:
    compact = value.strip()
    if len(compact) < 24:
        return False
    return (
        any(ch.islower() for ch in compact)
        and any(ch.isupper() for ch in compact)
        and any(ch.isdigit() for ch in compact)
    )


def _is_example_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    compact = normalized.replace("-", "_")
    return (
        normalized in {"replace", "required", "guest", "none", "null", "not_set", "unset"}
        or compact.startswith(("replace_with_", "change_me_", "changeme_", "your_"))
        or compact.endswith(("_example", "_sample", "_placeholder"))
        or "your_" in compact
        or "replace" in compact
        or "change_me" in compact
    )


def _git_file_state(path: Path, project_root: Path) -> str:
    if not _is_git_work_tree(project_root):
        return "unknown"
    rel_path = _relative_posix(path, project_root)
    if _git_check(["git", "-C", str(project_root), "ls-files", "--error-unmatch", "--", rel_path]):
        return "tracked"
    if _git_check(["git", "-C", str(project_root), "check-ignore", "-q", "--", rel_path]):
        return "ignored"
    return "untracked"


def _is_git_work_tree(project_root: Path) -> bool:
    return _git_check(["git", "-C", str(project_root), "rev-parse", "--is-inside-work-tree"])


def _git_check(command: list[str]) -> bool:
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return completed.returncode == 0


def _relative_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()
