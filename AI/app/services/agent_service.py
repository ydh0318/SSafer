import json
import logging
import re
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

from app.core.config import AGENT_ENABLED, AGENT_MAX_ITERATIONS
from app.prompts.agent_prompt import build_user_message
from app.services.input_service import format_finding_for_explanation_llm
from app.tools.code_context_tool import (
    reset_scan_result_context,
    set_scan_result_context,
)


logger = logging.getLogger(__name__)

_CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,}", re.IGNORECASE)
_AGENT_TRIGGER_SEVERITIES = {"HIGH", "CRITICAL"}
_MAX_WEB_REFS = 5
_STEPS_PER_ITERATION = 3  # AIMessage + ToolMessage + 다음 AIMessage 정도
_DESCRIPTION_PREVIEW = 200
_SNIPPET_PREVIEW = 300
_SUMMARY_PREVIEW = 240


def format_enriched_context_for_prompt(enriched: dict[str, Any] | None) -> str:
    """enriched_context를 explain/fix prompt 입력에 붙일 단일 문자열로 변환.

    빈/None이면 빈 문자열. 호출자는 finding_input 뒤에 그대로 append하면 된다.
    """
    if not enriched:
        return ""

    lines: list[str] = []
    cve = enriched.get("cve_info")
    if isinstance(cve, dict) and cve.get("available"):
        score = cve.get("cvss_score")
        severity = cve.get("severity")
        description = (cve.get("description") or "")[:_DESCRIPTION_PREVIEW]
        refs = cve.get("references") or []
        ref_urls = [r.get("url") for r in refs[:3] if isinstance(r, dict) and r.get("url")]
        lines.append(
            f"- CVE: id={cve.get('cve_id')} cvss={score} severity={severity}"
        )
        if description:
            lines.append(f"  description: {description}")
        if ref_urls:
            lines.append(f"  references: {ref_urls}")

    code = enriched.get("code_context")
    if isinstance(code, dict) and code.get("available"):
        snippet = (code.get("snippet") or "")[:_SNIPPET_PREVIEW]
        lines.append(
            f"- Code context ({code.get('target')} lines {code.get('line_range')}):"
        )
        if snippet:
            lines.append(snippet)

    web_refs = enriched.get("web_refs")
    if isinstance(web_refs, list) and web_refs:
        titles = [w.get("title") for w in web_refs[:3] if isinstance(w, dict)]
        lines.append(f"- Web refs (top {len(titles)}): {titles}")

    summary = enriched.get("agent_summary")
    if isinstance(summary, str) and summary.strip():
        lines.append(f"- Agent summary: {summary[:_SUMMARY_PREVIEW]}")

    if not lines:
        return ""
    return (
        "\n\nAdditional research context from agent tools (use for accuracy, do not invent):\n"
        + "\n".join(lines)
    )


def should_use_agent(finding: dict[str, Any]) -> bool:
    """agent 경로로 보낼지 결정.

    트리거 조건 (둘 중 하나라도 만족):
      1) ruleId/title/maskedEvidence에 CVE-YYYY-NNNN 식별자 → NVD 조회로 풍부한 분석
      2) severity가 HIGH/CRITICAL → 코드 컨텍스트 + 웹 검색으로 보강

    LOW/MEDIUM의 단순 misconfig는 기존 batch 경로로 빠르게 처리한다.
    """
    if not AGENT_ENABLED:
        return False

    haystack = " ".join(
        str(value)
        for value in (
            finding.get("ruleId"),
            finding.get("title"),
            finding.get("maskedEvidence"),
        )
        if isinstance(value, str)
    )
    if _CVE_PATTERN.search(haystack):
        return True

    severity = (finding.get("severity") or "").upper()
    if severity in _AGENT_TRIGGER_SEVERITIES:
        return True

    return False


def _extract_message_text(content: Any) -> str:
    """LangChain message content는 string 또는 list[dict] (Anthropic 형식). 둘 다 처리."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts)
    return ""


def _parse_tool_result(raw: Any) -> Any:
    """ToolMessage.content는 보통 JSON-직렬화된 string. dict/list로 복원 시도."""
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


def _build_enriched_from_messages(messages: list[Any]) -> dict[str, Any]:
    """agent의 messages 리스트에서 tool 호출/결과/최종 요약을 enriched_context로 변환.

    LangGraph create_agent 출력 형식:
      - AIMessage(content=..., tool_calls=[{id, name, args}, ...])
      - ToolMessage(content=..., tool_call_id=..., name=...)
      - 마지막 AIMessage(content=..., tool_calls=[]) → 최종 요약
    """
    enriched: dict[str, Any] = {"tool_calls": []}
    cve_info: dict[str, Any] | None = None
    code_context: dict[str, Any] | None = None
    web_refs: list[dict[str, Any]] = []

    pending: dict[str, dict[str, Any]] = {}
    last_ai_summary: str = ""

    for msg in messages:
        if isinstance(msg, AIMessage):
            calls = getattr(msg, "tool_calls", None) or []
            if calls:
                for call in calls:
                    cid = call.get("id")
                    if cid:
                        pending[cid] = {
                            "name": call.get("name"),
                            "args": call.get("args"),
                        }
            else:
                text = _extract_message_text(msg.content)
                if text:
                    last_ai_summary = text
        elif isinstance(msg, ToolMessage):
            cid = getattr(msg, "tool_call_id", None)
            info = pending.pop(cid, {}) if cid else {}
            tool_name = info.get("name") or getattr(msg, "name", None)
            tool_args = info.get("args")
            result = _parse_tool_result(msg.content)

            enriched["tool_calls"].append(
                {"tool": tool_name, "args": tool_args, "result": result}
            )

            if tool_name == "search_cve" and isinstance(result, dict) and result.get("available"):
                cve_info = result
            elif tool_name == "analyze_code_context" and isinstance(result, dict) and result.get("available"):
                code_context = result
            elif tool_name == "search_web" and isinstance(result, list):
                web_refs.extend(r for r in result if isinstance(r, dict))

    if cve_info is not None:
        enriched["cve_info"] = cve_info
    if code_context is not None:
        enriched["code_context"] = code_context
    if web_refs:
        enriched["web_refs"] = web_refs[:_MAX_WEB_REFS]
    enriched["agent_summary"] = last_ai_summary
    return enriched


def run_agent_for_finding(
    finding: dict[str, Any],
    scan_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """finding 하나에 대해 agent를 실행하고 enriched_context를 반환.

    어떤 이유로든 실패하면 빈 enriched_context를 반환 (fail-open).
    호출자는 이 enriched_context를 explain/fix prompt에 추가 입력으로 넣는다.
    """
    if not AGENT_ENABLED:
        return {}

    from app.chains.agent_chain import build_agent  # 지연 import (테스트 친화)

    finding_input = format_finding_for_explanation_llm(finding)
    finding_id = finding.get("id")

    token = None
    if scan_result is not None:
        token = set_scan_result_context(scan_result)

    try:
        agent = build_agent()
        result = agent.invoke(
            {
                "messages": [
                    {"role": "user", "content": build_user_message(finding_input)}
                ]
            },
            config={"recursion_limit": AGENT_MAX_ITERATIONS * _STEPS_PER_ITERATION},
        )
    except Exception as exc:
        logger.warning(
            "Agent execution failed for finding %s: %s (continuing with empty context)",
            finding_id,
            exc,
        )
        return {}
    finally:
        if token is not None:
            try:
                reset_scan_result_context(token)
            except (LookupError, ValueError):
                pass

    messages = result.get("messages") if isinstance(result, dict) else None
    enriched = _build_enriched_from_messages(messages or [])
    logger.info(
        "Agent completed for finding %s. tool_calls=%d has_cve=%s has_code=%s web_refs=%d",
        finding_id,
        len(enriched.get("tool_calls") or []),
        "cve_info" in enriched,
        "code_context" in enriched,
        len(enriched.get("web_refs") or []),
    )
    return enriched
