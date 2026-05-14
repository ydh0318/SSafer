from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Callable

import httpx

from ssafer import __version__
from ssafer.core.auth import normalize_api_url
from ssafer.core.config import load_project_config
from ssafer.core.constants import MASK
from ssafer.core.result_store import load_last_scan
from ssafer.core.sanitize import AWS_KEY_RE, PRIVATE_KEY_RE, is_placeholder, is_secret_key
from ssafer.server.audit import load_last_server_audit


DEFAULT_API_URL = "https://ssafer.co.kr"
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
    "auditId",
    "analysisStatus",
    "scannedAt",
    "generatedAt",
}


def upload_last_scan(
    project_root: Path,
    api_url: str | None = None,
    token: str | None = None,
    on_step: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    _emit_step(on_step, "최근 로컬 스캔 결과를 확인하는 중...")
    scan = load_last_scan(project_root)
    if scan is None:
        raise RuntimeError(
            "업로드할 로컬 스캔 결과가 없습니다. 먼저 프로젝트 루트에서 'ssafer run'을 실행하세요."
        )
    if not _scan_has_targets(scan):
        raise RuntimeError(
            "업로드할 스캔 대상이 없습니다. 프로젝트 루트에서 'ssafer run'을 다시 실행하거나 "
            "'ssafer run --path <프로젝트 경로>'로 대상 경로를 지정하세요."
        )
    return _upload_result(
        project_root=project_root,
        result=scan,
        api_url=api_url,
        token=token,
        scan_type=None,
        source="CLI",
        name=_scan_name(scan),
        on_step=on_step,
    )


def _scan_has_targets(scan: dict[str, Any]) -> bool:
    summary = scan.get("cliSummary", {})
    target_counts = [
        summary.get("composeSets"),
        summary.get("envFiles"),
        summary.get("dockerfiles"),
    ]
    if any(value is not None for value in target_counts):
        return any(int(value or 0) > 0 for value in target_counts)

    targets = scan.get("targets", {})
    return any(
        len(targets.get(key) or []) > 0
        for key in ("composeSets", "envFiles", "dockerfiles")
    ) or not targets


def upload_scan_result_to_registered_scan(
    project_root: Path,
    scan: dict[str, Any],
    *,
    api_url: str,
    token: str | None,
    scan_id: int,
    raw_upload_url: str,
    on_step: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    _emit_step(on_step, "업로드할 스캔 결과를 검증하는 중...")
    suspicious_paths = find_unmasked_secret_paths(scan)
    if suspicious_paths:
        paths = "\n".join(f"- {path}" for path in suspicious_paths[:20])
        suffix = "\n- ..." if len(suspicious_paths) > 20 else ""
        raise RuntimeError(
            "스캔 결과에 마스킹되지 않은 민감정보가 포함된 것으로 보여 업로드를 중단했습니다:\n"
            f"{paths}{suffix}"
        )

    base_url = normalize_api_url(api_url)
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    scan_json = _scan_json_bytes(scan)
    with httpx.Client(timeout=30) as client:
        _emit_step(on_step, "S3에 스캔 결과 JSON을 업로드하는 중...")
        upload_response = client.put(
            raw_upload_url,
            content=scan_json,
            headers={"Content-Type": "application/json"},
        )
        upload_response.raise_for_status()

        _emit_step(on_step, "백엔드에 업로드 완료를 알리는 중...")
        callback_response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/scans/{scan_id}/raw-results",
            json=_build_raw_upload_report_payload(scan, scan_json),
            headers=headers,
        )
        callback_response.raise_for_status()
        callback_data = _response_data(callback_response.json())
        callback_data.setdefault("scanId", scan_id)
        return callback_data


def upload_last_server_audit(
    project_root: Path,
    api_url: str | None = None,
    token: str | None = None,
    on_step: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    _emit_step(on_step, "최근 서버 점검 결과를 확인하는 중...")
    audit = load_last_server_audit(project_root)
    if audit is None:
        raise RuntimeError(
            "업로드할 server-audit 결과가 없습니다. 먼저 'ssafer server-audit'을 실행하세요."
        )
    return _upload_result(
        project_root=project_root,
        result=audit,
        api_url=api_url,
        token=token,
        scan_type="SERVER_AUDIT",
        source="CLI",
        name=_server_audit_name(audit, project_root),
        on_step=on_step,
    )


def _upload_result(
    *,
    project_root: Path,
    result: dict[str, Any],
    api_url: str | None,
    token: str | None,
    scan_type: str | None,
    source: str,
    name: str,
    on_step: Callable[[str], None] | None,
) -> dict[str, Any]:
    _emit_step(on_step, "업로드할 결과 JSON을 검증하는 중...")
    suspicious_paths = find_unmasked_secret_paths(result)
    if suspicious_paths:
        paths = "\n".join(f"- {path}" for path in suspicious_paths[:20])
        suffix = "\n- ..." if len(suspicious_paths) > 20 else ""
        raise RuntimeError(
            "스캔 결과에 마스킹되지 않은 민감정보가 포함된 것으로 보여 업로드를 중단했습니다:\n"
            f"{paths}{suffix}"
        )

    project_config = load_project_config(project_root, [])
    base_url = normalize_api_url(api_url or project_config.upload.endpoint or DEFAULT_API_URL)
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with httpx.Client(timeout=30) as client:
        _emit_step(on_step, "백엔드에 스캔 요청을 등록하는 중...")
        create_response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/scans",
            json=_build_create_scan_payload(
                project_root=project_root,
                result=result,
                scan_type=scan_type,
                source=source,
                name=name,
            ),
            headers=headers,
        )
        create_response.raise_for_status()
        create_data = _response_data(create_response.json())
        raw_upload_url = create_data.get("rawUploadUrl")
        raw_result_path = create_data.get("rawResultPath")
        remote_scan_id = create_data.get("scanId")
        if not raw_upload_url or not raw_result_path or remote_scan_id is None:
            raise RuntimeError("Backend scan registration response is missing raw upload information.")

        scan_json = _scan_json_bytes(result)
        _emit_step(on_step, "S3에 결과 JSON을 업로드하는 중...")
        upload_response = client.put(
            raw_upload_url,
            content=scan_json,
            headers={"Content-Type": "application/json"},
        )
        upload_response.raise_for_status()

        _emit_step(on_step, "백엔드에 업로드 완료를 알리는 중...")
        callback_response = _post_preserving_redirects(
            client,
            f"{base_url}/api/v1/scans/{remote_scan_id}/raw-results",
            json=_build_raw_upload_report_payload(result, scan_json),
            headers=headers,
        )
        callback_response.raise_for_status()
        callback_data = _response_data(callback_response.json())
        callback_data.setdefault("scanId", remote_scan_id)
        return callback_data


def _emit_step(on_step: Callable[[str], None] | None, message: str) -> None:
    if on_step is not None:
        on_step(message)


def _build_create_scan_payload(
    *,
    project_root: Path,
    result: dict[str, Any],
    scan_type: str | None,
    source: str,
    name: str,
) -> dict[str, Any]:
    payload = {
        "projectName": result.get("projectName") or project_root.name,
        "source": source,
        "scanName": name,
        "targetPath": str(project_root),
        "includeLogs": False,
    }
    if scan_type:
        payload["scanType"] = scan_type
    return payload


def _scan_name(scan: dict[str, Any]) -> str:
    scan_id = scan.get("scanId")
    return f"SSAfer CLI scan {scan_id}" if scan_id else "SSAfer CLI scan"


def _server_audit_name(audit: dict[str, Any], project_root: Path) -> str:
    audit_id = audit.get("auditId")
    host_name = project_root.name or "server"
    return f"SSAfer server audit {host_name} {audit_id}" if audit_id else f"SSAfer server audit {host_name}"


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
