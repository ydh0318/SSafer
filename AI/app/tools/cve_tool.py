import logging
import re
from functools import lru_cache
from typing import Any

import httpx
from langchain_core.tools import tool

from app.core.config import (
    NVD_API_ENDPOINT,
    NVD_API_KEY,
    NVD_CACHE_MAX_SIZE,
    NVD_TIMEOUT_SECONDS,
)


logger = logging.getLogger(__name__)

_CVE_ID_PATTERN = re.compile(r"^CVE-\d{4}-\d{4,}$", re.IGNORECASE)
_PREFERRED_CVSS_KEYS = ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2")
_MAX_REFERENCES = 5
_DESCRIPTION_MAX_CHARS = 400


def _normalize_cve_id(cve_id: str) -> str:
    return (cve_id or "").strip().upper()


def _is_valid_cve_id(cve_id: str) -> bool:
    return bool(_CVE_ID_PATTERN.match(cve_id))


def _extract_cvss(metrics: dict[str, Any]) -> tuple[float | None, str | None]:
    for key in _PREFERRED_CVSS_KEYS:
        entries = metrics.get(key)
        if not entries:
            continue
        first = entries[0] if isinstance(entries, list) else None
        if not isinstance(first, dict):
            continue
        cvss_data = first.get("cvssData") or {}
        score = cvss_data.get("baseScore")
        severity = cvss_data.get("baseSeverity") or first.get("baseSeverity")
        if isinstance(score, (int, float)):
            return float(score), severity if isinstance(severity, str) else None
    return None, None


def _extract_description(cve: dict[str, Any]) -> str:
    descriptions = cve.get("descriptions") or []
    for desc in descriptions:
        if isinstance(desc, dict) and desc.get("lang") == "en":
            value = desc.get("value")
            if isinstance(value, str) and value:
                return value[:_DESCRIPTION_MAX_CHARS]
    return ""


def _extract_references(cve: dict[str, Any]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for ref in cve.get("references") or []:
        if not isinstance(ref, dict):
            continue
        url = ref.get("url")
        if not isinstance(url, str) or not url:
            continue
        tags = ref.get("tags") or []
        normalized_tags = [t for t in tags if isinstance(t, str)]
        refs.append({"url": url, "tags": normalized_tags})
        if len(refs) >= _MAX_REFERENCES:
            break
    return refs


@lru_cache(maxsize=NVD_CACHE_MAX_SIZE)
def _fetch_cve_from_nvd(cve_id: str) -> dict[str, Any]:
    """NVD API에서 CVE 상세를 받아 핵심 필드만 추출. LRU 캐시 적용."""
    headers: dict[str, str] = {}
    if NVD_API_KEY:
        headers["apiKey"] = NVD_API_KEY

    try:
        with httpx.Client(timeout=NVD_TIMEOUT_SECONDS) as client:
            resp = client.get(
                NVD_API_ENDPOINT,
                params={"cveId": cve_id},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("NVD API call failed for %s: %s", cve_id, exc)
        return {"available": False, "cve_id": cve_id, "error": str(exc)}
    except Exception as exc:
        logger.warning("NVD API unexpected error for %s: %s", cve_id, exc)
        return {"available": False, "cve_id": cve_id, "error": str(exc)}

    vulnerabilities = data.get("vulnerabilities") or []
    if not vulnerabilities:
        return {"available": False, "cve_id": cve_id, "error": "not found"}

    cve = (vulnerabilities[0] or {}).get("cve") or {}
    score, severity = _extract_cvss(cve.get("metrics") or {})
    return {
        "available": True,
        "cve_id": cve_id,
        "cvss_score": score,
        "severity": severity,
        "description": _extract_description(cve),
        "published": cve.get("published"),
        "last_modified": cve.get("lastModified"),
        "references": _extract_references(cve),
    }


def clear_cve_cache() -> None:
    """테스트용. 운영에선 호출 안 함."""
    _fetch_cve_from_nvd.cache_clear()


@tool
def search_cve(cve_id: str) -> dict[str, Any]:
    """주어진 CVE ID의 CVSS 점수, 심각도, 설명, 참고 링크를 NVD 공식 API에서 조회한다.

    Args:
        cve_id: 조회할 CVE 식별자 (예: CVE-2024-21626).
    """
    normalized = _normalize_cve_id(cve_id)
    if not _is_valid_cve_id(normalized):
        return {
            "available": False,
            "cve_id": cve_id,
            "error": "invalid CVE id format (expected CVE-YYYY-NNNN+)",
        }
    return _fetch_cve_from_nvd(normalized)
