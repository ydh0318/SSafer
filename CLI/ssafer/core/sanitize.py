from __future__ import annotations

import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import yaml

from ssafer.core.constants import MASK, SAFE_KEYS, SECRET_KEYWORDS

SECRET_VALUE_RE = re.compile(
    r"(?i)(secret|token|api[_-]?key|password|passwd|pwd|private[_-]?key|access[_-]?key)"
)
URL_CREDENTIAL_RE = re.compile(r"(?P<scheme>[a-z][a-z0-9+.-]*://)(?P<user>[^:\s/@]+):(?P<password>[^@\s]+)@")
AWS_KEY_RE = re.compile(r"AKIA[0-9A-Z]{16}")
PRIVATE_KEY_RE = re.compile(
    r"-----BEGIN\s(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END[^\n]*KEY-----",
    re.MULTILINE,
)


@dataclass(frozen=True)
class CompiledMaskingPattern:
    name: str
    regex: re.Pattern[str]
    mask: str


def compile_extra_masking_patterns(patterns: list[Any], warnings: list[str]) -> list[CompiledMaskingPattern]:
    compiled: list[CompiledMaskingPattern] = []
    for pattern in patterns:
        try:
            compiled.append(
                CompiledMaskingPattern(
                    name=pattern.name,
                    regex=re.compile(pattern.regex),
                    mask=pattern.mask,
                )
            )
        except re.error as exc:
            warnings.append(f"Invalid masking.extra_patterns regex '{pattern.name}': {exc}")
    return compiled


def sanitize_compose_yaml(raw_yaml: str, extra_patterns: list[CompiledMaskingPattern] | None = None) -> str:
    extra_patterns = extra_patterns or []
    try:
        document = yaml.safe_load(raw_yaml) or {}
    except yaml.YAMLError:
        return conservative_mask_text(raw_yaml, extra_patterns)
    sanitized = sanitize_obj(document, extra_patterns=extra_patterns)
    return yaml.safe_dump(sanitized, sort_keys=False, allow_unicode=False)


def sanitize_obj(
    value: Any,
    key_hint: str | None = None,
    extra_patterns: list[CompiledMaskingPattern] | None = None,
) -> Any:
    extra_patterns = extra_patterns or []
    if isinstance(value, dict):
        sanitized: dict[Any, Any] = {}
        for key, child in value.items():
            key_text = str(key)
            if key_text in {"environment", "labels"}:
                sanitized[key] = sanitize_mapping_or_list(child, extra_patterns)
            elif key_text in {"command", "entrypoint"}:
                sanitized[key] = sanitize_command(child, extra_patterns)
            elif key_text == "args":
                sanitized[key] = sanitize_mapping_or_list(child, extra_patterns)
            elif is_secret_key(key_text):
                sanitized[key] = MASK
            else:
                sanitized[key] = sanitize_obj(child, key_text, extra_patterns)
        return sanitized
    if isinstance(value, list):
        return [sanitize_obj(item, key_hint, extra_patterns) for item in value]
    if isinstance(value, str):
        if key_hint and is_secret_key(key_hint):
            return MASK
        return sanitize_string(value, extra_patterns)
    return deepcopy(value)


def sanitize_mapping_or_list(value: Any, extra_patterns: list[CompiledMaskingPattern] | None = None) -> Any:
    extra_patterns = extra_patterns or []
    if isinstance(value, dict):
        result: dict[Any, Any] = {}
        for key, child in value.items():
            key_text = str(key)
            if is_safe_key(key_text):
                result[key] = sanitize_string(child, extra_patterns) if isinstance(child, str) else child
            else:
                result[key] = MASK if is_secret_key(key_text) else sanitize_obj(child, key_text, extra_patterns)
        return result
    if isinstance(value, list):
        result: list[Any] = []
        for item in value:
            if isinstance(item, str) and "=" in item:
                key, child = item.split("=", 1)
                if is_safe_key(key):
                    result.append(f"{key}={sanitize_string(child, extra_patterns)}")
                else:
                    result.append(f"{key}={MASK if is_secret_key(key) else sanitize_string(child, extra_patterns)}")
            else:
                result.append(sanitize_obj(item, extra_patterns=extra_patterns))
        return result
    return sanitize_obj(value, extra_patterns=extra_patterns)


def sanitize_command(value: Any, extra_patterns: list[CompiledMaskingPattern] | None = None) -> Any:
    extra_patterns = extra_patterns or []
    if isinstance(value, str):
        masked = apply_extra_patterns(sanitize_url_credentials(value), extra_patterns)
        if SECRET_VALUE_RE.search(masked):
            return "***MASKED_COMMAND_CONTAINS_SECRET***"
        return masked
    if isinstance(value, list):
        joined = " ".join(str(item) for item in value)
        if SECRET_VALUE_RE.search(joined):
            return ["***MASKED_COMMAND_CONTAINS_SECRET***"]
        return [sanitize_string(str(item), extra_patterns) for item in value]
    return sanitize_obj(value, extra_patterns=extra_patterns)


def sanitize_string(value: str, extra_patterns: list[CompiledMaskingPattern] | None = None) -> str:
    extra_patterns = extra_patterns or []
    value = sanitize_url_credentials(value)
    value = AWS_KEY_RE.sub("AKIA****MASKED****", value)
    value = PRIVATE_KEY_RE.sub("[PRIVATE KEY REDACTED]", value)
    value = apply_extra_patterns(value, extra_patterns)
    return value


def apply_extra_patterns(value: str, extra_patterns: list[CompiledMaskingPattern]) -> str:
    for pattern in extra_patterns:
        value = pattern.regex.sub(pattern.mask, value)
    return value


def sanitize_url_credentials(value: str) -> str:
    return URL_CREDENTIAL_RE.sub(lambda match: f"{match.group('scheme')}{match.group('user')}:{MASK}@", value)


def conservative_mask_text(text: str, extra_patterns: list[CompiledMaskingPattern] | None = None) -> str:
    extra_patterns = extra_patterns or []
    lines: list[str] = []
    for line in text.splitlines():
        if SECRET_VALUE_RE.search(line):
            lines.append(MASK)
        else:
            lines.append(sanitize_string(line, extra_patterns))
    return "\n".join(lines)


def is_secret_key(key: str) -> bool:
    normalized = key.upper().replace("-", "_")
    return any(keyword in normalized for keyword in SECRET_KEYWORDS)


def is_safe_key(key: str) -> bool:
    normalized = key.upper().replace("-", "_")
    return (
        normalized in SAFE_KEYS
        or normalized.endswith("_EXPIRES_SECONDS")
        or normalized.endswith("_EXPIRES_MS")
        or normalized.endswith("_EXPIRES_IN")
        or normalized.endswith("_TTL")
        or normalized.endswith("_TIMEOUT")
        or normalized.endswith("_INTERVAL")
        or normalized.endswith("_ACCESS_KEY_ID")
        or normalized.endswith("_CLIENT_ID")
        or normalized.endswith("_USER")
        or normalized.endswith("_USERNAME")
    )


def make_masked_evidence(key: str, masked_value: str = MASK, max_len: int = 120) -> str:
    evidence = f"{key}={masked_value}"
    return evidence[:max_len]


def classify_value(value: str) -> str:
    if not value:
        return "empty"
    if is_placeholder(value):
        return "placeholder"
    if SECRET_VALUE_RE.search(value):
        return "secret-like"
    if len(value) >= 32 and re.search(r"[A-Za-z]", value) and re.search(r"\d", value):
        return "secret-like"
    return "plain"


def is_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    compact = normalized.replace("-", "_")
    return (
        normalized in {
            "changeme",
            "change-me",
            "change_me",
            "todo",
            "example",
            "password",
            "admin",
            "root",
            "guest",
            "test",
            "dummy",
            "sample",
            "replace",
            "replace_me",
            "replace-me",
            "required",
            "unset",
            "not_set",
            "none",
            "null",
            "your-token",
            "your_token",
            "xxx",
            "xxxx",
        }
        or normalized.startswith("${") and normalized.endswith("}")
        or compact.startswith("your_") and compact.endswith("_here")
        or compact.endswith("_here")
        or compact.startswith("replace_")
        or compact.startswith("replace_with_")
        or compact.startswith("change_me_")
        or "replace" in compact
        or "change_me" in compact
        or set(compact) == {"x"}
    )


def mask_value(_: str) -> str:
    return MASK
