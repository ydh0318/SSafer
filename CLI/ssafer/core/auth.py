from __future__ import annotations

import base64
import json
import os
import hashlib
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx
import yaml

CONFIG_PATH = Path.home() / ".ssafer" / "config.yml"
PROJECT_AGENT_CONFIG_NAME = "agent.yml"
ENV_TOKEN_KEY = "SSAFER_TOKEN"
DEFAULT_API_URL = "https://ssafer.co.kr"
LEGACY_API_HOST_ALIASES = {
    "k14b105.p.ssafy.io": "ssafer.co.kr",
}


def normalize_api_url(api_url: str | None) -> str:
    """Return the canonical API base URL to avoid auth-stripping cross-host redirects."""
    if not api_url:
        return DEFAULT_API_URL
    stripped = api_url.rstrip("/")
    parsed = urlparse(stripped)
    canonical_host = LEGACY_API_HOST_ALIASES.get(parsed.netloc.lower())
    if not canonical_host:
        return stripped
    return urlunparse((parsed.scheme or "https", canonical_host, parsed.path, "", "", "")).rstrip("/")


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


def describe_token_source(token_env_key: str | None = None) -> str:
    """Return where load_token() would read the token from, without exposing it."""
    if token_env_key:
        env_token = os.environ.get(token_env_key)
        if env_token:
            return f"env:{token_env_key}"
    env_token = os.environ.get(ENV_TOKEN_KEY)
    if env_token:
        return f"env:{ENV_TOKEN_KEY}"
    config = _load_config()
    upload_config = config.get("upload", {})
    if upload_config.get("accessToken"):
        return "config:upload.accessToken"
    if upload_config.get("token"):
        return "config:upload.token"
    return "none"


def load_auth_mode() -> str | None:
    """Return the saved auth mode, if known."""
    config = _load_config()
    upload_config = config.get("upload", {})
    auth_mode = upload_config.get("authMode")
    return str(auth_mode).strip().lower() if auth_mode else None


def load_auth_identity() -> tuple[str | None, str | None]:
    """Return saved auth mode and token subject, if known."""
    config = _load_config()
    upload_config = config.get("upload", {})
    auth_mode = upload_config.get("authMode")
    auth_subject = upload_config.get("authSubject")
    mode = str(auth_mode).strip().lower() if auth_mode else None
    subject = str(auth_subject).strip() if auth_subject else None
    return mode, subject


def login_with_credentials(endpoint: str, email: str, password: str) -> dict[str, Any]:
    """Authenticate with the SSAfer backend and return token response data."""
    base_url = normalize_api_url(endpoint)
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def enter_guest_mode(endpoint: str, device_id: str | None = None) -> dict[str, Any]:
    """Issue a guest access token from the SSAfer backend."""
    base_url = normalize_api_url(endpoint)
    body = {"deviceId": device_id} if device_id else {}
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/guests/enter",
            json=body,
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def register_user(endpoint: str, email: str, display_name: str, password: str) -> dict[str, Any]:
    """Create a SSAfer backend user account and return response data."""
    base_url = normalize_api_url(endpoint)
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/users",
            json={"email": email, "displayName": display_name, "password": password},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def send_email_verification_code(endpoint: str, email: str) -> dict[str, Any]:
    """Ask the SSAfer backend to send an email verification code."""
    base_url = normalize_api_url(endpoint)
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/auth/email/send-code",
            json={"email": email},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def verify_email_code(endpoint: str, email: str, code: str) -> dict[str, Any]:
    """Verify a backend-issued email code before signup."""
    base_url = normalize_api_url(endpoint)
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/auth/email/verify-code",
            json={"email": email, "code": code},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def issue_project_agent_token(endpoint: str, project_id: int, access_token: str) -> dict[str, Any]:
    """Issue a local-agent token for a project."""
    base_url = normalize_api_url(endpoint)
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/projects/{project_id}/agent/token",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def create_project(
    endpoint: str,
    access_token: str,
    *,
    name: str,
    description: str | None = None,
    default_scan_mode: str = "AGENT",
    monitor_enabled: bool = False,
) -> dict[str, Any]:
    """Create a SSAfer project visible to the logged-in user."""
    base_url = normalize_api_url(endpoint)
    body: dict[str, Any] = {
        "name": name,
        "description": description,
        "defaultScanMode": default_scan_mode,
        "monitorEnabled": monitor_enabled,
    }
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=30) as client:
        response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/projects",
            json=body,
            headers=headers,
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def list_projects(endpoint: str, access_token: str, *, page: int = 0, size: int = 100) -> list[dict[str, Any]]:
    """Return projects visible to the logged-in user."""
    base_url = normalize_api_url(endpoint)
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        response = client.get(
            f"{base_url}/api/v1/projects",
            params={"page": page, "size": size},
            headers=headers,
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    if isinstance(data, dict):
        items = data.get("items") or data.get("content") or data.get("projects")
        return items if isinstance(items, list) else []
    return data if isinstance(data, list) else []


def get_project_agent_status(endpoint: str, project_id: int, access_token: str) -> dict[str, Any]:
    """Return the backend-visible Local Agent status for a project."""
    base_url = normalize_api_url(endpoint)
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        response = client.get(
            f"{base_url}/api/v1/projects/{project_id}/agent/status",
            headers=headers,
        )
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def withdraw_current_user(endpoint: str, access_token: str) -> None:
    """Withdraw the currently authenticated member account."""
    base_url = normalize_api_url(endpoint)
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        response = client.delete(
            f"{base_url}/api/v1/users",
            headers=headers,
        )
        response.raise_for_status()


def save_auth_tokens(auth_data: dict[str, Any], endpoint: str | None = None) -> None:
    """Persist backend-issued auth tokens for later upload requests."""
    access_token = auth_data.get("accessToken") or auth_data.get("guestAccessToken")
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
    if auth_data.get("guestAccessToken"):
        upload_config["authMode"] = "guest"
        upload_config["guestAccessTokenExpiresAt"] = str(auth_data.get("expiresAt") or "")
    else:
        upload_config["authMode"] = "member"
        upload_config.pop("guestAccessTokenExpiresAt", None)
    auth_subject = _jwt_subject(str(access_token))
    if auth_subject:
        upload_config["authSubject"] = auth_subject
    else:
        upload_config.pop("authSubject", None)
    upload_config.pop("token", None)
    if endpoint:
        upload_config["endpoint"] = normalize_api_url(endpoint)
    CONFIG_PATH.write_text(yaml.safe_dump(config, allow_unicode=True), encoding="utf-8")


def project_agent_config_path(project_root: Path | None = None) -> Path:
    return (project_root or Path(".")).resolve() / ".ssafer" / PROJECT_AGENT_CONFIG_NAME


def _candidate_project_roots(project_root: Path | None = None) -> list[Path]:
    root = (project_root or Path(".")).resolve()
    candidates = [root, *root.parents]
    return [candidate for candidate in candidates if candidate != candidate.parent]


def _fallback_project_agent_config_path(project_root: Path | None = None) -> Path:
    project_key = str((project_root or Path(".")).resolve())
    project_hash = hashlib.sha256(project_key.encode("utf-8")).hexdigest()[:16]
    return CONFIG_PATH.parent / "projects" / project_hash / PROJECT_AGENT_CONFIG_NAME


def _project_agent_config_paths(project_root: Path | None = None) -> list[Path]:
    paths: list[Path] = []
    for root in _candidate_project_roots(project_root):
        local_path = project_agent_config_path(root)
        fallback_path = _fallback_project_agent_config_path(root)
        paths.append(local_path)
        if local_path != fallback_path:
            paths.append(fallback_path)
    unique_paths: list[Path] = []
    for path in paths:
        if path not in unique_paths:
            unique_paths.append(path)
    return unique_paths


def save_agent_config(agent_data: dict[str, Any], endpoint: str | None = None, project_root: Path | None = None) -> None:
    agent_id = agent_data.get("agentId")
    project_id = agent_data.get("projectId")
    agent_token = agent_data.get("agentToken")
    if agent_id is None or project_id is None or not agent_token:
        raise ValueError("Agent token response is missing agentId, projectId, or agentToken.")

    agent_config: dict[str, Any] = {}
    agent_config["agentId"] = int(agent_id)
    agent_config["projectId"] = int(project_id)
    agent_config["agentToken"] = str(agent_token)
    if endpoint:
        agent_config["endpoint"] = normalize_api_url(endpoint)

    local_path = project_agent_config_path(project_root)
    fallback_path = _fallback_project_agent_config_path(project_root)
    try:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_text(yaml.safe_dump(agent_config, allow_unicode=True), encoding="utf-8")
        return
    except OSError:
        fallback_path.parent.mkdir(parents=True, exist_ok=True)
        fallback_path.write_text(yaml.safe_dump(agent_config, allow_unicode=True), encoding="utf-8")
        return


def load_agent_config(project_root: Path | None = None) -> dict[str, Any]:
    path = find_agent_config_path(project_root)
    if path is None:
        return {}
    try:
        loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return {}
    agent_config = loaded if isinstance(loaded, dict) else {}
    return agent_config if isinstance(agent_config, dict) else {}


def find_agent_config_path(project_root: Path | None = None) -> Path | None:
    for path in _project_agent_config_paths(project_root):
        if not path.exists():
            continue
        return path
    return None


def clear_agent_config(project_root: Path | None = None) -> None:
    """Remove saved project-local agent credentials."""
    for path in _project_agent_config_paths(project_root):
        if path.exists():
            path.unlink()


def save_token(token: str, endpoint: str | None = None) -> None:
    """~/.ssafer/config.yml에 토큰 저장."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = _load_config()
    config.setdefault("upload", {})["token"] = token
    if endpoint:
        config["upload"]["endpoint"] = normalize_api_url(endpoint)
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
        config["upload"].pop("authMode", None)
        config["upload"].pop("authSubject", None)
        config["upload"].pop("guestAccessTokenExpiresAt", None)
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
    return normalize_api_url(config.get("upload", {}).get("endpoint"))


def _post_preserving_redirects(
    client: httpx.Client,
    url: str,
    *,
    json: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    max_redirects: int = 3,
) -> httpx.Response:
    current_url = url
    for _ in range(max_redirects + 1):
        kwargs: dict[str, Any] = {}
        if json is not None:
            kwargs["json"] = json
        if headers is not None:
            kwargs["headers"] = headers
        response = client.post(current_url, **kwargs)
        if response.status_code not in {301, 302, 303, 307, 308}:
            return response
        location = response.headers.get("location")
        if not location:
            return response
        current_url = str(response.url.join(location))
    return response


def _jwt_subject(token: str) -> str | None:
    parts = token.split(".")
    if len(parts) < 2:
        return None
    payload = parts[1]
    padding = "=" * (-len(payload) % 4)
    try:
        decoded = base64.urlsafe_b64decode((payload + padding).encode("ascii"))
        claims = json.loads(decoded.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    subject = claims.get("sub")
    return str(subject) if subject else None


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError:
        return {}
