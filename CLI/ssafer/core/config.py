from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


CONFIG_FILE_NAME = "ssafer.yml"


@dataclass(frozen=True)
class UploadConfig:
    endpoint: str | None = None
    token_env: str | None = None


@dataclass(frozen=True)
class RulesConfig:
    exclude: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MaskingPatternConfig:
    name: str
    regex: str
    mask: str


@dataclass(frozen=True)
class MaskingConfig:
    extra_patterns: list[MaskingPatternConfig] = field(default_factory=list)


@dataclass(frozen=True)
class ProjectConfig:
    project_name: str | None = None
    upload: UploadConfig = field(default_factory=UploadConfig)
    rules: RulesConfig = field(default_factory=RulesConfig)
    masking: MaskingConfig = field(default_factory=MaskingConfig)


def load_project_config(project_root: Path, warnings: list[str] | None = None) -> ProjectConfig:
    config_path = project_root / CONFIG_FILE_NAME
    if not config_path.exists():
        return ProjectConfig()

    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        _warn(warnings, f"Failed to parse {CONFIG_FILE_NAME}: {exc}")
        return ProjectConfig()

    if not isinstance(raw, dict):
        _warn(warnings, f"{CONFIG_FILE_NAME} must contain a YAML mapping at the top level.")
        return ProjectConfig()

    return ProjectConfig(
        project_name=_optional_string(raw, "project_name", warnings),
        upload=_parse_upload(raw.get("upload"), warnings),
        rules=_parse_rules(raw.get("rules"), warnings),
        masking=_parse_masking(raw.get("masking"), warnings),
    )


def _parse_upload(value: Any, warnings: list[str] | None) -> UploadConfig:
    if value is None:
        return UploadConfig()
    if not isinstance(value, dict):
        _warn(warnings, f"{CONFIG_FILE_NAME} upload must be a mapping.")
        return UploadConfig()
    return UploadConfig(
        endpoint=_optional_string(value, "endpoint", warnings, section="upload"),
        token_env=_optional_string(value, "token_env", warnings, section="upload"),
    )


def _parse_rules(value: Any, warnings: list[str] | None) -> RulesConfig:
    if value is None:
        return RulesConfig()
    if not isinstance(value, dict):
        _warn(warnings, f"{CONFIG_FILE_NAME} rules must be a mapping.")
        return RulesConfig()
    return RulesConfig(exclude=_string_list(value.get("exclude"), "rules.exclude", warnings))


def _parse_masking(value: Any, warnings: list[str] | None) -> MaskingConfig:
    if value is None:
        return MaskingConfig()
    if not isinstance(value, dict):
        _warn(warnings, f"{CONFIG_FILE_NAME} masking must be a mapping.")
        return MaskingConfig()

    patterns = value.get("extra_patterns")
    if patterns is None:
        return MaskingConfig()
    if not isinstance(patterns, list):
        _warn(warnings, f"{CONFIG_FILE_NAME} masking.extra_patterns must be a list.")
        return MaskingConfig()

    parsed: list[MaskingPatternConfig] = []
    for idx, pattern in enumerate(patterns):
        path = f"masking.extra_patterns[{idx}]"
        if not isinstance(pattern, dict):
            _warn(warnings, f"{CONFIG_FILE_NAME} {path} must be a mapping.")
            continue
        name = pattern.get("name")
        regex = pattern.get("regex")
        mask = pattern.get("mask")
        if not all(isinstance(item, str) and item for item in [name, regex, mask]):
            _warn(warnings, f"{CONFIG_FILE_NAME} {path} requires non-empty name, regex, and mask strings.")
            continue
        parsed.append(MaskingPatternConfig(name=name, regex=regex, mask=mask))
    return MaskingConfig(extra_patterns=parsed)


def _optional_string(
    mapping: dict[str, Any],
    key: str,
    warnings: list[str] | None,
    section: str | None = None,
) -> str | None:
    value = mapping.get(key)
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    path = f"{section}.{key}" if section else key
    _warn(warnings, f"{CONFIG_FILE_NAME} {path} must be a string.")
    return None


def _string_list(value: Any, path: str, warnings: list[str] | None) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        _warn(warnings, f"{CONFIG_FILE_NAME} {path} must be a list.")
        return []
    result: list[str] = []
    for idx, item in enumerate(value):
        if isinstance(item, str) and item:
            result.append(item)
        else:
            _warn(warnings, f"{CONFIG_FILE_NAME} {path}[{idx}] must be a non-empty string.")
    return result


def _warn(warnings: list[str] | None, message: str) -> None:
    if warnings is not None:
        warnings.append(message)
