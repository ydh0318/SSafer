from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

CONFIG_PATH = Path.home() / ".ssafer" / "config.yml"
ENV_TOKEN_KEY = "SSAFER_TOKEN"
DEFAULT_API_URL = "http://localhost:8080"


def load_token() -> str | None:
    """토큰 우선순위: 1) 환경변수 SSAFER_TOKEN  2) ~/.ssafer/config.yml"""
    env_token = os.environ.get(ENV_TOKEN_KEY)
    if env_token:
        return env_token.strip()
    config = _load_config()
    token = config.get("upload", {}).get("token")
    return token.strip() if token else None


def save_token(token: str, endpoint: str | None = None) -> None:
    """~/.ssafer/config.yml에 토큰 저장."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = _load_config()
    config.setdefault("upload", {})["token"] = token
    if endpoint:
        config["upload"]["endpoint"] = endpoint
    CONFIG_PATH.write_text(yaml.safe_dump(config, allow_unicode=True), encoding="utf-8")


def clear_token() -> None:
    """저장된 토큰 삭제."""
    config = _load_config()
    if "upload" in config:
        config["upload"].pop("token", None)
        if not config["upload"]:
            del config["upload"]
    if not config:
        if CONFIG_PATH.exists():
            CONFIG_PATH.unlink()
        return
    CONFIG_PATH.write_text(yaml.safe_dump(config, allow_unicode=True), encoding="utf-8")


def load_endpoint() -> str:
    """저장된 endpoint 반환, 없으면 DEFAULT_API_URL 반환."""
    config = _load_config()
    return config.get("upload", {}).get("endpoint") or DEFAULT_API_URL


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError:
        return {}
