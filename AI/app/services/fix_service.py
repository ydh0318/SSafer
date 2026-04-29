import json
from typing import Any

from app.chains.fix_chain import create_fix_chain
from app.services.explain_service import contains_disallowed_script
from app.services.input_service import format_finding_for_llm


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

    return parsed


def generate_finding_fix(finding: dict[str, Any]) -> dict[str, Any]:
    chain = create_fix_chain()
    finding_input = format_finding_for_llm(finding)
    last_error: ValueError | None = None

    for attempt in range(MAX_FIX_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            prompt_input = "\n".join(
                [
                    finding_input,
                    "",
                    "중요:",
                    "이전 답변이 요구 조건을 지키지 못했습니다.",
                    "응답은 반드시 유효한 JSON 객체 하나만 반환하세요.",
                    "JSON 객체 밖에 어떤 문자도 쓰지 마세요.",
                    "마크다운 코드 블록, 설명 문장, 주석은 포함하지 마세요.",
                    "아래 6개 key만 정확히 사용하세요.",
                    "summary, priority, recommendedActions, codeGuidance, verification, cautions",
                    "priority는 high, medium, low 중 하나만 사용하세요.",
                    "recommendedActions는 2~5개의 문자열 배열로 작성하세요.",
                    "cautions는 1~3개의 문자열 배열로 작성하세요.",
                    "답변의 자연어 문장은 한국어로만 작성하세요.",
                    "일본어, 중국어, 한자, 깨진 문자를 절대 사용하지 마세요.",
                    "일반 영어 단어를 섞지 말고 쉬운 한국어로 바꾸세요.",
                    "finding에 없는 파일 구조, 패키지명, 함수명, 설정 키, 배포 환경을 단정하지 마세요.",
                    "비밀 값이나 민감한 값을 추측하거나 복원하지 마세요.",
                    "실행 명령어, 공격 절차, 악용 코드는 작성하지 마세요.",
                    "파일명, 규칙 ID, 탐지 ID, 근거 값만 원문 그대로 유지할 수 있습니다.",
                ]
            )

        raw_fix = chain.invoke({"finding_input": prompt_input})
        if contains_disallowed_script(raw_fix):
            last_error = ValueError(
                "Fix Chain output contains Japanese, Chinese, Hanja, or broken characters."
            )
            continue

        try:
            return parse_fix_response(raw_fix)
        except ValueError as exc:
            last_error = exc

    raise ValueError("Fix Chain output could not be parsed.") from last_error


def generate_finding_fixes(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "finding_id": finding["id"],
            "fix": generate_finding_fix(finding),
        }
        for finding in findings
    ]
