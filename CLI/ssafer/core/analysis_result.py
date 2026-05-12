from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from ssafer.core.auth import normalize_api_url


def download_analysis_result_for_scan(
    project_root: Path,
    *,
    scan_id: int,
    api_url: str,
    token: str,
) -> Path:
    download_info = issue_analysis_result_download_url(api_url, scan_id=scan_id, token=token)
    download_url = download_info.get("downloadUrl")
    if not isinstance(download_url, str) or not download_url.strip():
        raise ValueError("Analysis result download response is missing downloadUrl.")

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(download_url)
        response.raise_for_status()

    payload = response.json()
    destination = analysis_result_cache_path(project_root, scan_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return destination


def find_latest_done_scan_id(api_url: str, *, project_id: int, token: str) -> int:
    endpoint = f"{normalize_api_url(api_url)}/api/v1/projects/{project_id}/scans"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"page": 0, "size": 1, "status": "DONE"}
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(endpoint, headers=headers, params=params)
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError(f"projectId={project_id}에 완료된 스캔이 없습니다.")
    scan_id = items[0].get("scanId") if isinstance(items[0], dict) else None
    if scan_id is None:
        raise ValueError("최신 스캔 응답에 scanId가 없습니다.")
    return int(scan_id)


def issue_analysis_result_download_url(api_url: str, *, scan_id: int, token: str) -> dict[str, Any]:
    endpoint = f"{normalize_api_url(api_url)}/api/v1/scans/{scan_id}/analysis-result/download-url"
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(endpoint, headers=headers)
        response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    if not isinstance(data, dict):
        raise ValueError("Analysis result download response data must be an object.")
    return data


def analysis_result_cache_path(project_root: Path, scan_id: int) -> Path:
    return project_root / ".ssafer" / "analysis" / "scans" / str(scan_id) / "analysis_result.json"
