import contextvars
import logging
from typing import Any

from langchain_core.tools import tool


logger = logging.getLogger(__name__)

_DEFAULT_CONTEXT_LINES = 10
_MAX_CONTEXT_LINES = 50
_PREVIEW_LINES_WHEN_NO_LINE = 40

_current_scan_result: contextvars.ContextVar[dict[str, Any] | None] = (
    contextvars.ContextVar("ssafer_current_scan_result", default=None)
)


def set_scan_result_context(scan_result: dict[str, Any]) -> contextvars.Token:
    """agent 실행 시작 시 호출. tool이 이 scan_result에서 artifacts를 읽는다."""
    return _current_scan_result.set(scan_result)


def reset_scan_result_context(token: contextvars.Token) -> None:
    """agent 실행 종료 시 호출."""
    _current_scan_result.reset(token)


def _find_artifact_content(
    scan_result: dict[str, Any], target: str
) -> str | None:
    artifacts = scan_result.get("artifacts")
    if not isinstance(artifacts, list):
        return None
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        if artifact.get("target") == target:
            content = artifact.get("content")
            if isinstance(content, str):
                return content
    return None


def _clamp_context_lines(value: int) -> int:
    if value <= 0:
        return _DEFAULT_CONTEXT_LINES
    return min(value, _MAX_CONTEXT_LINES)


@tool
def analyze_code_context(
    target: str, line: int = 0, context_lines: int = _DEFAULT_CONTEXT_LINES
) -> dict[str, Any]:
    """주어진 파일(target)의 특정 라인 주변 코드를 반환한다.

    외부 네트워크 호출 없이 현재 scan_result에 포함된 artifact 내용에서 읽는다.

    Args:
        target: 분석할 파일 경로 또는 target 식별자 (scan_result.artifacts[].target과 일치해야 함)
        line: 중심이 될 라인 번호 (1-based). 0이면 파일 처음 부분을 미리보기로 반환.
        context_lines: 중심 라인 위·아래로 가져올 라인 수 (기본 10, 최대 50).
    """
    scan_result = _current_scan_result.get()
    if scan_result is None:
        logger.warning(
            "analyze_code_context called without scan_result context"
        )
        return {
            "available": False,
            "target": target,
            "reason": "no scan context available",
        }

    content = _find_artifact_content(scan_result, target)
    if content is None:
        return {
            "available": False,
            "target": target,
            "reason": "artifact not found in scan_result",
        }

    lines = content.splitlines()
    total = len(lines)
    if total == 0:
        return {
            "available": False,
            "target": target,
            "reason": "artifact content is empty",
        }

    if line <= 0:
        end = min(total, _PREVIEW_LINES_WHEN_NO_LINE)
        return {
            "available": True,
            "target": target,
            "snippet": "\n".join(lines[:end]),
            "line_range": [1, end],
            "total_lines": total,
            "mode": "preview",
        }

    span = _clamp_context_lines(context_lines)
    start = max(1, line - span)
    end = min(total, line + span)
    return {
        "available": True,
        "target": target,
        "snippet": "\n".join(lines[start - 1 : end]),
        "line_range": [start, end],
        "total_lines": total,
        "mode": "centered",
    }
