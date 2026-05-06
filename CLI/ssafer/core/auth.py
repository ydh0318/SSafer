from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
import yaml

CONFIG_PATH = Path.home() / ".ssafer" / "config.yml"
ENV_TOKEN_KEY = "SSAFER_TOKEN"
DEFAULT_API_URL = "http://localhost:8080"


def load_token(token_env_key: str | None = None) -> str | None:
    """토큰 우선순위: 1) 환경변수 SSAFER_TOKEN  2) ~/.ssafer/config.yml"""
    if token_env_key:
        env_token = os.environ.get(token_env_key)
        if env_token:
            return env_token.strip()
    env_token = os.environ.get(ENV_TOKEN_KEY)
    if env_token:
        return env_token.strip()
    config = _load_config()
    upload_config = config.get("upload", {})
    token = upload_config.get("accessToken") or upload_config.get("token")
    return token.strip() if token else None


def login_with_credentials(endpoint: str, email: str, password: str) -> dict[str, Any]:
    """Authenticate with the SSAfer backend and return token response data."""
    base_url = endpoint.rstrip("/")
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def register_user(endpoint: str, email: str, display_name: str, password: str) -> dict[str, Any]:
    """Create a SSAfer backend user account and return response data."""
    base_url = endpoint.rstrip("/")
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{base_url}/api/v1/users",
            json={"email": email, "displayName": display_name, "password": password},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def send_email_verification_code(endpoint: str, email: str) -> dict[str, Any]:
    """Ask the SSAfer backend to send an email verification code."""
    base_url = endpoint.rstrip("/")
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{base_url}/api/v1/auth/email/send-code",
            json={"email": email},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def verify_email_code(endpoint: str, email: str, code: str) -> dict[str, Any]:
    """Verify a backend-issued email code before signup."""
    base_url = endpoint.rstrip("/")
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{base_url}/api/v1/auth/email/verify-code",
            json={"email": email, "code": code},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def save_auth_tokens(auth_data: dict[str, Any], endpoint: str | None = None) -> None:
    """Persist backend-issued auth tokens for later upload requests."""
    access_token = auth_data.get("accessToken")
    if not access_token:
        raise ValueError("Login response is missing accessToken.")

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = _load_config()
    upload_config = config.setdefault("upload", {})
    upload_config["accessToken"] = str(access_token)
    if auth_data.get("accessTokenExpiresAt"):
        upload_config["accessTokenExpiresAt"] = str(auth_data["accessTokenExpiresAt"])
    if auth_data.get("refreshToken"):
        upload_config["refreshToken"] = str(auth_data["refreshToken"])
    if auth_data.get("refreshTokenExpiresAt"):
        upload_config["refreshTokenExpiresAt"] = str(auth_data["refreshTokenExpiresAt"])
    upload_config.pop("token", None)
    if endpoint:
        upload_config["endpoint"] = endpoint
    CONFIG_PATH.write_text(yaml.safe_dump(config, allow_unicode=True), encoding="utf-8")


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
        config["upload"].pop("accessToken", None)
        config["upload"].pop("accessTokenExpiresAt", None)
        config["upload"].pop("refreshToken", None)
        config["upload"].pop("refreshTokenExpiresAt", None)
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
