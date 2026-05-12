import json
from typing import Any

from app.chains.fix_chain import create_fix_chain
from app.core.llm import invoke_llm_with_retry
from app.services.explain_service import contains_disallowed_script
from app.services.input_service import format_finding_for_llm
from app.services.result_service import validate_fix_schema


MAX_FIX_RETRIES = 2
REQUIRED_FIX_FIELDS = (
    "summary",
    "priority",
    "recommendedActions",
    "codeGuidance",
    "verification",
    "cautions",
)
ALLOWED_FIX_PRIORITIES = ("high", "medium", "low")


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
    if not isinstance(cautions, list) or not 1 <= len(cautions) <= 3:
        raise ValueError("Fix Chain output field 'cautions' must contain 1 to 3 items.")

    for field, values in (
        ("recommendedActions", recommended_actions),
        ("cautions", cautions),
    ):
        if not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError(
                f"Fix Chain output field '{field}' must contain non-empty strings."
            )

    try:
        validate_fix_schema(parsed, "Fix Chain output")
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
            "JSON 객체 하나만 반환하고, 마크다운 코드 블록은 쓰지 마세요.",
            "summary, priority, recommendedActions, codeGuidance, verification, cautions를 항상 포함하세요.",
            "사용자에게 보이는 자연어 필드는 한국어 중심으로 작성하세요.",
            "파일명, 규칙 ID, 탐지 ID, 기술명, 코드 조각은 원문을 유지할 수 있습니다.",
            "priority는 high, medium, low 중 하나여야 합니다.",
            "recommendedActions는 비어 있지 않은 문자열 2~5개여야 합니다.",
            "cautions는 비어 있지 않은 문자열 1~3개여야 합니다.",
            "finding.patchContext가 없으면 patches를 생략하세요.",
            "replace patch는 patchId, findingId, operation, filePath, oldText, newText, expectedFileHash를 포함해야 합니다.",
            "append patch는 patchId, findingId, operation, filePath, newText, expectedFileHash를 포함하고 oldText를 생략해야 합니다.",
            "patches[].operation은 replace 또는 append여야 합니다.",
            "patches[].filePath는 finding.filePath와 같아야 하며 슬래시를 사용해야 합니다.",
            "patches[].expectedFileHash는 sha256:으로 시작해야 합니다.",
            "replace patch에서는 patchContext.oldText를 oldText에 그대로 복사하세요.",
            "append patch는 완성된 명령을 파일 끝에 추가해도 안전한 Dockerfile에만 사용하세요.",
            "docker-compose YAML에는 append를 사용하지 마세요.",
            "oldText나 newText에 ***MASKED***, [MASKED], <MASKED> 같은 마스킹 값을 넣지 마세요.",
            "대상 파일, 정확한 oldText, 안전한 newText가 불확실하면 patches 키를 생략하세요.",
        ]
    )


def generate_finding_fix(finding: dict[str, Any]) -> dict[str, Any]:
    chain = create_fix_chain()
    finding_input = format_finding_for_llm(finding)
    last_error: ValueError | None = None

    for attempt in range(MAX_FIX_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0 and last_error is not None:
            prompt_input = build_fix_retry_prompt(
                finding_input=finding_input,
                error_message=str(last_error),
            )

        raw_fix = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        if contains_disallowed_script(raw_fix):
            last_error = ValueError(
                "Fix Chain output contains Japanese, Chinese, Hanja, or broken characters."
            )
            continue

        try:
            return parse_fix_response(raw_fix)
        except ValueError as exc:
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
