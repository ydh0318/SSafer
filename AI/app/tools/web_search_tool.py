import logging
from typing import Any

import httpx
from langchain_core.tools import tool

from app.core.config import (
    HASDATA_API_KEY,
    HASDATA_ENABLED,
    HASDATA_MAX_RESULTS,
    HASDATA_SERP_ENDPOINT,
    HASDATA_TIMEOUT_SECONDS,
)


logger = logging.getLogger(__name__)

_MAX_RESULTS_CAP = 5
_SNIPPET_MAX_CHARS = 300


def _extract_serp_results(
    data: dict[str, Any], max_results: int
) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    organic = data.get("organicResults") or []
    if not isinstance(organic, list):
        return results

    for item in organic:
        if len(results) >= max_results:
            break
        if not isinstance(item, dict):
            continue
        link = item.get("link") or ""
        if not isinstance(link, str) or not link:
            continue
        title = item.get("title") or ""
        snippet = item.get("snippet") or ""
        if isinstance(snippet, str) and len(snippet) > _SNIPPET_MAX_CHARS:
            snippet = snippet[:_SNIPPET_MAX_CHARS]
        results.append(
            {
                "title": title if isinstance(title, str) else "",
                "url": link,
                "snippet": snippet if isinstance(snippet, str) else "",
            }
        )
    return results


@tool
def search_web(query: str, max_results: int = 3) -> list[dict[str, str]]:
    """일반 웹 검색을 수행한다. CVE가 아닌 보안 모범사례, 설정 가이드,
    일반 컨텍스트가 필요할 때 사용한다.

    Args:
        query: 검색 키워드 (예: "Dockerfile non-root user best practice").
        max_results: 반환할 결과 수 (1-5, 기본 3).
    """
    if not HASDATA_ENABLED or not HASDATA_API_KEY:
        return []

    requested = max(1, min(max_results, _MAX_RESULTS_CAP, HASDATA_MAX_RESULTS))
    payload = {
        "q": query,
        "domain": "google.com",
        "gl": "us",
        "hl": "en",
        "num": requested,
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
        logger.warning(
            "HasData SERP request failed for query: %s", query, exc_info=True
        )
        return []

    return _extract_serp_results(data, requested)
