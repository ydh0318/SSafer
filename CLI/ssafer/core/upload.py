from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import httpx

from ssafer import __version__
from ssafer.core.config import load_project_config
from ssafer.core.constants import MASK
from ssafer.core.result_store import load_last_scan
from ssafer.core.sanitize import AWS_KEY_RE, PRIVATE_KEY_RE, is_placeholder, is_secret_key


DEFAULT_API_URL = "https://k14b105.p.ssafy.io"
IGNORED_SECRET_PATH_KEYS = {
    "id",
    "ruleId",
    "ruleCode",
    "source",
    "sourceType",
    "severity",
    "title",
    "file",
    "filePath",
    "line",
    "lineNumber",
    "hash",
    "schemaVersion",
    "scanId",
    "analysisStatus",
    "scannedAt",
}


def upload_last_scan(
    project_root: Path,
    api_url: str | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    scan = load_last_scan(project_root)
    if scan is None:
        raise RuntimeError("No local scan package found. Run 'ssafer run' first.")

    suspicious_paths = find_unmasked_secret_paths(scan)
    if suspicious_paths:
        paths = "\n".join(f"- {path}" for path in suspicious_paths[:20])
        suffix = "\n- ..." if len(suspicious_paths) > 20 else ""
        raise RuntimeError(
            "Upload blocked because the scan package may contain unmasked secrets:\n"
            f"{paths}{suffix}"
        )

    project_config = load_project_config(project_root, [])
    base_url = (api_url or project_config.upload.endpoint or DEFAULT_API_URL).rstrip("/")
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with httpx.Client(timeout=30) as client:
        create_response = client.post(
            f"{base_url}/api/v1/scans",
            json=_build_create_scan_payload(project_root, scan),
            headers=headers,
        )
        create_response.raise_for_status()
        create_data = _response_data(create_response.json())
        raw_upload_url = create_data.get("rawUploadUrl")
        raw_result_path = create_data.get("rawResultPath")
        remote_scan_id = create_data.get("scanId")
        if not raw_upload_url or not raw_result_path or remote_scan_id is None:
            raise RuntimeError("Backend scan registration response is missing raw upload information.")

        scan_json = _scan_json_bytes(scan)
        upload_response = client.put(
            raw_upload_url,
            content=scan_json,
            headers={"Content-Type": "application/json"},
        )
        upload_response.raise_for_status()

        callback_response = client.post(
            f"{base_url}/api/v1/scans/{remote_scan_id}/raw-results",
            json=_build_raw_upload_report_payload(scan, scan_json),
            headers=headers,
        )
        callback_response.raise_for_status()
        return callback_response.json()


def _build_create_scan_payload(project_root: Path, scan: dict[str, Any]) -> dict[str, Any]:
    return {
        "projectName": scan.get("projectName") or project_root.name,
        "source": "CLI",
        "scanName": _scan_name(scan),
        "targetPath": str(project_root),
        "includeLogs": False,
    }


def _scan_name(scan: dict[str, Any]) -> str:
    scan_id = scan.get("scanId")
    return f"SSAfer CLI scan {scan_id}" if scan_id else "SSAfer CLI scan"


def _build_raw_upload_report_payload(scan: dict[str, Any], scan_json: bytes) -> dict[str, Any]:
    return {
        "tool": "ssafer-cli",
        "toolVersion": str(scan.get("toolVersion") or __version__),
        "resultCount": len(scan.get("findings") or []),
        "payloadHash": _payload_hash(scan_json),
    }


def _payload_hash(content: bytes) -> str:
    return f"sha256:{hashlib.sha256(content).hexdigest()}"


def _response_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _scan_json_bytes(scan: dict[str, Any]) -> bytes:
    import json

    return json.dumps(scan, ensure_ascii=False).encode("utf-8")


def find_unmasked_secret_paths(payload: Any) -> list[str]:
    findings: list[str] = []
    _walk_payload(payload, "$", None, findings)
    return findings


def _walk_payload(value: Any, path: str, key_hint: str | None, findings: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key)
            _walk_payload(child, f"{path}.{key_text}", key_text, findings)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            _walk_payload(child, f"{path}[{index}]", key_hint, findings)
        return
    if isinstance(value, str) and _is_unmasked_secret_value(value, path, key_hint):
        findings.append(path)


def _is_unmasked_secret_value(value: str, path: str, key_hint: str | None) -> bool:
    text = value.strip()
    if not text or _is_known_safe_value(text):
        return False
    if AWS_KEY_RE.search(text) or PRIVATE_KEY_RE.search(text):
        return True
    if _is_trivy_secret_match_path(path):
        return True
    if key_hint and _is_secret_payload_key(key_hint):
        return True
    return False


def _is_known_safe_value(value: str) -> bool:
    if value == MASK or MASK in value:
        return True
    if value.startswith("sha256:"):
        return True
    if is_placeholder(value):
        return True
    return False


def _is_secret_payload_key(key: str) -> bool:
    if key in IGNORED_SECRET_PATH_KEYS:
        return False
    return is_secret_key(key)


def _is_trivy_secret_match_path(path: str) -> bool:
    return ".Secrets[" in path and path.endswith(".Match")
