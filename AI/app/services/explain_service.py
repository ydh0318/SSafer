import json
import re
from typing import Any

from app.chains.explain_chain import create_explain_chain
from app.core.llm import invoke_llm_with_retry
from app.services.input_service import format_finding_for_llm


DISALLOWED_SCRIPT_PATTERN = re.compile(
    r"[\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"
)
MAX_EXPLAIN_RETRIES = 4
REQUIRED_EXPLANATION_FIELDS = (
    "summary",
    "whyRisky",
    "abuseScenario",
    "expectedImpact",
    "severityInterpretation",
)


def contains_disallowed_script(text: str) -> bool:
    return bool(DISALLOWED_SCRIPT_PATTERN.search(text))


def get_disallowed_scripts(text: str) -> str:
    return "".join(sorted(set(DISALLOWED_SCRIPT_PATTERN.findall(text))))


def validate_korean_natural_text(text: str, path: str) -> None:
    if contains_disallowed_script(text):
        raise ValueError(f"{path} contains disallowed foreign or broken characters.")


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


def parse_explain_response(response: str) -> dict[str, Any]:
    normalized = _normalize_json_response(response)

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError:
        if normalized:
            validate_korean_natural_text(normalized, "explanation")
            return {
                "explanation": _legacy_explanation_sections(normalized),
                "impact": normalized,
            }
        raise ValueError("Explain Chain output must be a valid JSON object.")

    if not isinstance(parsed, dict):
        raise ValueError("Explain Chain output must be a JSON object.")

    explanation = parsed.get("explanation")
    impact = parsed.get("impact")
    if isinstance(explanation, str) and explanation.strip():
        explanation = _legacy_explanation_sections(explanation)
    _validate_explanation_sections(explanation)
    if not isinstance(impact, str) or not impact.strip():
        raise ValueError("Explain Chain output field 'impact' must be a string.")
    validate_korean_natural_text(impact, "impact")

    return {
        "explanation": explanation,
        "impact": impact,
    }


def _legacy_explanation_sections(explanation: str) -> dict[str, str]:
    return {
        field: explanation
        for field in REQUIRED_EXPLANATION_FIELDS
    }


def _validate_explanation_sections(explanation: Any) -> None:
    if not isinstance(explanation, dict):
        raise ValueError("Explain Chain output field 'explanation' must be an object.")

    missing_fields = [
        field for field in REQUIRED_EXPLANATION_FIELDS if field not in explanation
    ]
    if missing_fields:
        raise ValueError(
            "Explain Chain output field 'explanation' missing required fields: "
            + ", ".join(missing_fields)
        )

    for field in REQUIRED_EXPLANATION_FIELDS:
        value = explanation[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"Explain Chain output field 'explanation.{field}' must be a string."
            )
        validate_korean_natural_text(value, f"explanation.{field}")


def generate_finding_explanation(finding: dict[str, Any]) -> dict[str, Any]:
    chain = create_explain_chain()
    finding_input = format_finding_for_llm(finding)
    last_disallowed_scripts = ""

    for attempt in range(MAX_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            retry_instructions = [
                finding_input,
                "",
                "중요:",
                "이전 답변에 허용되지 않는 문자가 포함되었습니다.",
                f"금지 문자 예시: {last_disallowed_scripts}",
                "자연어 설명은 한국어 중심으로 작성하세요.",
                "일본어, 중국어, 한자, 태국어, 스페인어, 라틴어, 깨진 문자를 절대 사용하지 마세요.",
                "설명은 한국어 중심으로 작성하고, 파일명, 규칙 ID, 탐지 ID, 기술명은 원문을 유지할 수 있습니다.",
                "입력 finding에 없는 파일 구조, 코드 흐름, 프레임워크, 공격 성공 여부를 단정하지 마세요.",
                "비밀 값이나 민감한 값을 추측하거나 복원하지 마세요.",
                "코드 예시, 설정 예시, 명령어, 표, 마크다운 코드 블록은 작성하지 마세요.",
                "JSON 객체만 출력하고, 앞뒤 인사말이나 추가 요약은 쓰지 마세요.",
                "JSON에는 explanation과 impact 필드만 포함하세요.",
                "explanation은 summary, whyRisky, abuseScenario, expectedImpact, severityInterpretation 객체입니다.",
                "impact는 완전 초보자도 이해할 수 있도록 쉬운 비유를 사용한 설명입니다.",
                "모든 문장을 작성한 뒤, 허용되지 않는 문자가 있으면 답변 전체를 다시 작성하세요.",
                "확신이 없으면 더 짧고 단순한 한국어 문장으로 답하세요.",
            ]

            if attempt == MAX_EXPLAIN_RETRIES:
                retry_instructions.extend(
                    [
                        "",
                        "마지막 재시도 형식:",
                        "아래 5개 섹션을 각각 한 문장으로만 작성하세요.",
                        "문장을 짧게 쓰고, 괄호와 영어 설명을 쓰지 마세요.",
                        "finding에 있는 정보만 사용하세요.",
                        '반드시 {"explanation":{"summary":"...","whyRisky":"...","abuseScenario":"...","expectedImpact":"...","severityInterpretation":"..."},"impact":"..."} 형식으로 답하세요.',
                        "explanation의 각 필드에는 한 문장만 작성하세요.",
                        "impact에는 쉬운 비유를 사용해 2문장으로 작성하세요.",
                    ]
                )

            prompt_input = "\n".join(retry_instructions)

        explanation = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        last_disallowed_scripts = get_disallowed_scripts(explanation)
        if last_disallowed_scripts:
            continue
        try:
            return parse_explain_response(explanation)
        except ValueError:
            if attempt == MAX_EXPLAIN_RETRIES:
                raise
            continue

    raise ValueError(
        "Explain Chain output contains disallowed foreign or broken characters: "
        f"{last_disallowed_scripts}"
    )


def generate_finding_explanations(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "finding_id": finding["id"],
            **generate_finding_explanation(finding),
        }
        for finding in findings
    ]
