import logging
import re
from typing import Any

import httpx

from app.core.config import (
    HASDATA_API_KEY,
    HASDATA_ENABLED,
    HASDATA_MAX_RESULTS,
    HASDATA_SERP_ENDPOINT,
    HASDATA_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


def _build_search_query(finding: dict[str, Any]) -> str:
    title = finding.get("title") or ""
    rule_id = finding.get("ruleId") or ""

    cve_match = re.search(r"CVE-\d{4}-\d+", f"{title} {rule_id}")
    if cve_match:
        return f"{cve_match.group()} vulnerability advisory"

    keywords: list[str] = []
    if rule_id:
        keywords.append(rule_id)
    if title:
        keywords.append(title)
    keywords.append("security fix")
    return " ".join(keywords)


def _extract_references(serp_data: dict[str, Any], max_results: int) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for item in serp_data.get("organicResults", []):
        if len(refs) >= max_results:
            break
        link = item.get("link") or ""
        if not link:
            continue
        refs.append({
            "title": item.get("title") or "",
            "url": link,
            "snippet": item.get("snippet") or "",
        })
    return refs


def fetch_finding_references(finding: dict[str, Any]) -> list[dict[str, str]]:
    if not HASDATA_ENABLED or not HASDATA_API_KEY:
        return []

    query = _build_search_query(finding)
    payload = {
        "q": query,
        "domain": "google.com",
        "gl": "us",
        "hl": "en",
        "num": HASDATA_MAX_RESULTS,
        "deviceType": "desktop",
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": HASDATA_API_KEY,
    }

    try:
        with httpx.Client(timeout=HASDATA_TIMEOUT_SECONDS) as client:
            resp = client.post(HASDATA_SERP_ENDPOINT, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        logger.warning("HasData SERP request failed for query: %s", query, exc_info=True)
        return []

    return _extract_references(data, HASDATA_MAX_RESULTS)


def fetch_findings_references(
    findings: list[dict[str, Any]],
) -> dict[str, list[dict[str, str]]]:
    if not HASDATA_ENABLED or not HASDATA_API_KEY:
        return {}

    refs_by_id: dict[str, list[dict[str, str]]] = {}
    for finding in findings:
        finding_id = finding.get("id") or ""
        refs_by_id[finding_id] = fetch_finding_references(finding)
    return refs_by_id
