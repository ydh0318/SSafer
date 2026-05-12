from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from ssafer.core.constants import BASE_COMPOSE, OVERRIDE_COMPOSE


@dataclass(frozen=True)
class ComposeSet:
    name: str
    directory: Path
    files: list[Path]
    env_files: list[Path]
    independent: bool = False


ENV_PATTERN = re.compile(r"^(docker-compose|compose)\.(?P<env>.+)\.(yml|yaml)$")


def build_compose_sets(compose_files: list[Path], warnings: list[str]) -> list[ComposeSet]:
    by_dir: dict[Path, list[Path]] = {}
    for file in compose_files:
        by_dir.setdefault(file.parent, []).append(file)

    sets: list[ComposeSet] = []
    for directory, files in sorted(by_dir.items()):
        names = {file.name.lower(): file for file in files}
        base_files = [names[name] for name in BASE_COMPOSE if name in names]
        override_files = [names[name] for name in OVERRIDE_COMPOSE if name in names]
        env_files = _env_compose_files(files)

        if base_files:
            base = sorted(base_files)[0]
            default_files = [base, *sorted(override_files)]
            sets.append(ComposeSet("default", directory, default_files, _matching_env_files(directory, "default")))
            for env_name, env_compose in env_files:
                sets.append(
                    ComposeSet(env_name, directory, [base, env_compose], _matching_env_files(directory, env_name))
                )
        else:
            for env_name, env_compose in env_files:
                warnings.append(
                    f"[ssafer-compose name={env_name} files={env_compose}] "
                    "기본 Compose 파일 없이 단독으로 분석했습니다."
                )
                sets.append(
                    ComposeSet(env_name, directory, [env_compose], _matching_env_files(directory, env_name), True)
                )

    return sets


def render_effective_config(compose_set: ComposeSet) -> tuple[bool, str, str | None, str | None]:
    command = ["docker", "compose"]
    for env_file in compose_set.env_files:
        command.extend(["--env-file", str(env_file)])
    for compose_file in compose_set.files:
        command.extend(["-f", str(compose_file)])
    command.append("config")

    try:
        completed = subprocess.run(
            command,
            cwd=compose_set.directory,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
    except FileNotFoundError:
        return False, "", "Docker CLI was not found.", None
    except subprocess.TimeoutExpired:
        return False, "", f"docker compose config timed out for compose set '{compose_set.name}'.", None

    stdout, stdout_warnings = _split_compose_warning_lines(completed.stdout)
    stderr_warning = completed.stderr.strip()

    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "docker compose config failed."
        return False, "", detail, None
    warning_parts = [part for part in [stderr_warning, *stdout_warnings] if part]
    warning = "\n".join(warning_parts) or None
    return True, stdout, None, warning


def _split_compose_warning_lines(stdout: str) -> tuple[str, list[str]]:
    config_lines: list[str] = []
    warning_lines: list[str] = []
    for line in stdout.splitlines():
        if "level=warning" in line or "variable is not set" in line:
            warning_lines.append(line)
        else:
            config_lines.append(line)
    config = "\n".join(config_lines)
    if stdout.endswith("\n") and config:
        config += "\n"
    return config, warning_lines


def _env_compose_files(files: list[Path]) -> list[tuple[str, Path]]:
    pairs: list[tuple[str, Path]] = []
    for file in files:
        name = file.name.lower()
        if name in BASE_COMPOSE or name in OVERRIDE_COMPOSE:
            continue
        match = ENV_PATTERN.match(name)
        if not match:
            continue
        env_name = match.group("env")
        if env_name == "override":
            continue
        pairs.append((env_name, file))
    return sorted(pairs, key=lambda item: item[0])


def _matching_env_files(directory: Path, set_name: str) -> list[Path]:
    candidates = [directory / ".env"]
    if set_name != "default":
        candidates.append(directory / f".env.{set_name}")
    return [path for path in candidates if path.exists()]


_LOCAL_KEYWORDS = {"dev", "local", "development", "test"}
_PROD_KEYWORDS = {"prod", "production"}

_LOCAL_ENV_VALUES = {
    "dev", "development", "local", "test", "debug",
}
_LOCAL_ENV_KEYS = {
    "SPRING_PROFILES_ACTIVE",
    "FLASK_ENV",
    "NODE_ENV",
    "APP_ENV",
    "RAILS_ENV",
    "ENVIRONMENT",
}


def detect_environment_from_compose_sets(
    compose_sets: list[ComposeSet],
    effective_configs: dict[str, str] | None = None,
) -> str:
    has_local = False
    for cs in compose_sets:
        for f in cs.files:
            name_lower = f.name.lower()
            if "override" in name_lower:
                continue
            path_lower = str(f).lower().replace("\\", "/")
            for kw in _PROD_KEYWORDS:
                if kw in name_lower or f"/{kw}/" in path_lower:
                    return "production"
            for kw in _LOCAL_KEYWORDS:
                if kw in name_lower or f"/{kw}/" in path_lower:
                    has_local = True

    if has_local:
        return "local"

    if effective_configs:
        result = _detect_from_compose_content(effective_configs)
        if result:
            return result

    return "production"


def _detect_from_compose_content(effective_configs: dict[str, str]) -> str | None:
    import yaml

    local_signals = 0
    prod_signals = 0

    for raw_yaml in effective_configs.values():
        try:
            doc = yaml.safe_load(raw_yaml) or {}
        except yaml.YAMLError:
            continue
        for svc in (doc.get("services") or {}).values():
            if not isinstance(svc, dict):
                continue
            if svc.get("build"):
                local_signals += 1
            env = svc.get("environment") or {}
            env_items: dict[str, str] = {}
            if isinstance(env, dict):
                env_items = {str(k).upper(): str(v).lower() for k, v in env.items() if v is not None}
            elif isinstance(env, list):
                for entry in env:
                    if isinstance(entry, str) and "=" in entry:
                        k, v = entry.split("=", 1)
                        env_items[k.strip().upper()] = v.strip().lower()
            for key in _LOCAL_ENV_KEYS:
                val = env_items.get(key)
                if val and val in _LOCAL_ENV_VALUES:
                    local_signals += 1
                elif val and val in {"prod", "production"}:
                    prod_signals += 1

    if prod_signals > 0:
        return "production"
    if local_signals >= 2:
        return "local"
    return None
