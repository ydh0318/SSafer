import json
import logging
from typing import Any

from app.chains.fix_chain import create_fix_chain
from app.core.config import LLM_FIX_MAX_TOKENS
from app.core.llm import invoke_llm_with_retry
from app.services.explain_service import contains_disallowed_script
from app.services.input_service import format_finding_for_fix_llm
from app.services.llm_usage_service import get_llm_response_text, log_llm_usage
from app.services.result_service import validate_fix_schema


MAX_FIX_RETRIES = 1
logger = logging.getLogger(__name__)
REQUIRED_FIX_FIELDS = (
    "summary",
    "priority",
    "recommendedActions",
    "codeGuidance",
    "verification",
    "cautions",
)
ALLOWED_FIX_PRIORITIES = ("critical", "high", "medium", "low")


def _normalize_json_response(response: str) -> str:
    normalized = response.strip()

    if normalized.startswith("```"):
        lines = normalized.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        normalized = "\n".join(lines).strip()

    return normalized


def parse_fix_response(response: str) -> dict[str, Any]:
    normalized = _normalize_json_response(response)

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError as exc:
        raise ValueError("Fix Chain output must be a valid JSON object.") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Fix Chain output must be a JSON object.")

    missing_fields = [field for field in REQUIRED_FIX_FIELDS if field not in parsed]
    if missing_fields:
        raise ValueError(
            f"Fix Chain output missing required fields: {', '.join(missing_fields)}"
        )

    for field in ("summary", "codeGuidance", "verification"):
        value = parsed[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Fix Chain output field '{field}' must be a string.")

    priority = parsed["priority"]
    if not isinstance(priority, str) or priority not in ALLOWED_FIX_PRIORITIES:
        raise ValueError(
            "Fix Chain output field 'priority' must be one of: "
            f"{', '.join(ALLOWED_FIX_PRIORITIES)}."
        )

    recommended_actions = parsed["recommendedActions"]
    if not isinstance(recommended_actions, list) or not 2 <= len(recommended_actions) <= 5:
        raise ValueError(
            "Fix Chain output field 'recommendedActions' must contain 2 to 5 items."
        )

    cautions = parsed["cautions"]
    if not isinstance(cautions, list) or len(cautions) > 3:
        raise ValueError("Fix Chain output field 'cautions' must contain 0 to 3 items.")

    for field, values in (
        ("recommendedActions", recommended_actions),
        ("cautions", cautions),
    ):
        if not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError(
                f"Fix Chain output field '{field}' must contain non-empty strings."
            )

    try:
        validate_fix_schema(parsed, "Fix Chain output", strict_patch_metadata=False)
    except ValueError as exc:
        raise ValueError(
            f"Fix Chain output failed schema validation: {exc}"
        ) from exc

    return parsed


def build_fix_retry_prompt(finding_input: str, error_message: str) -> str:
    return "\n".join(
        [
            finding_input,
            "",
            "이전 수정 JSON이 검증에 실패했으므로 다시 작성하세요.",
            f"검증 오류: {error_message}",
            "JSON 객체만 다시 출력하세요.",
            "필수 필드: summary, priority, recommendedActions, codeGuidance, verification, cautions.",
            "priority는 critical, high, medium, low 중 하나입니다.",
            "recommendedActions는 2~5개의 문자열 배열, cautions는 0~3개의 문자열 배열입니다.",
            "주의할 점이 떠오르지 않으면 cautions를 빈 배열 []로 두세요.",
            "자연어는 한국어 중심으로 작성하세요.",
            "source가 server-audit 이거나 Scan Type이 SERVER_AUDIT 이면 patches를 만들지 말고 운영 조치와 확인 명령 중심으로 작성하세요.",
            "patches는 안전할 때만 포함하고, 불확실하면 생략하세요.",
            "patches는 finding.patchContext가 있을 때만 생성하세요.",
            "patch operation은 finding.patchContext.operation 값을 그대로 쓰세요.",
            "operation이 replace면 oldText는 patchContext.oldText를 그대로 사용하고 AI가 재작성하지 마세요.",
            "operation이 append면 oldText를 새로 만들지 마세요.",
            "각 patch는 operation, oldText, newText만 포함하세요. filePath, expectedFileHash, patchId, findingId는 출력하지 마세요.",
        ]
    )


def generate_finding_fix(finding: dict[str, Any]) -> dict[str, Any]:
    chain = create_fix_chain()
    finding_input = format_finding_for_fix_llm(finding)
    finding_id = finding.get("id")
    last_error: ValueError | None = None

    for attempt in range(MAX_FIX_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0 and last_error is not None:
            prompt_input = build_fix_retry_prompt(
                finding_input=finding_input,
                error_message=str(last_error),
            )

        raw_fix_response = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        raw_fix = get_llm_response_text(raw_fix_response)
        log_llm_usage(
            logger=logger,
            stage="FIX",
            finding_id=finding_id if isinstance(finding_id, str) else None,
            input_text=prompt_input,
            response=raw_fix_response,
            attempt_count=attempt + 1,
            max_output_tokens=LLM_FIX_MAX_TOKENS,
        )
        if contains_disallowed_script(raw_fix):
            last_error = ValueError(
                "Fix Chain output contains Japanese, Chinese, Hanja, or broken characters."
            )
            continue

        try:
            return parse_fix_response(raw_fix)
        except ValueError as exc:
            logger.warning(
                "Fix Chain parse failed. findingId=%s attempt=%d error=%s raw_fix=%r",
                finding_id,
                attempt + 1,
                exc,
                raw_fix,
            )
            last_error = exc

    message = "Fix Chain output could not be parsed."
    if last_error is not None:
        message = f"{message} Last error: {last_error}"
    raise ValueError(message) from last_error


def generate_finding_fixes(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "finding_id": finding["id"],
            "fix": generate_finding_fix(finding),
        }
        for finding in findings
    ]
