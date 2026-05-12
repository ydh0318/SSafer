import json
import logging
import re
from typing import Any

from app.chains.explain_chain import create_explain_chain
from app.core.config import LLM_EXPLAIN_MAX_TOKENS
from app.core.llm import invoke_llm_with_retry
from app.services.input_service import format_finding_for_explanation_llm
from app.services.llm_usage_service import get_llm_response_text, log_llm_usage


DISALLOWED_SCRIPT_PATTERN = re.compile(
    r"[\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"
)
MAX_EXPLAIN_RETRIES = 1
logger = logging.getLogger(__name__)
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
    finding_input = format_finding_for_explanation_llm(finding)
    finding_id = finding.get("id")
    last_disallowed_scripts = ""

    for attempt in range(MAX_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            retry_instructions = [
                finding_input,
                "",
                "이전 응답이 검증에 실패했습니다.",
                f"금지 문자: {last_disallowed_scripts or '없음'}",
                "JSON만 다시 출력하세요.",
                "필수 형식: {\"explanation\":{\"summary\":\"...\",\"whyRisky\":\"...\",\"abuseScenario\":\"...\",\"expectedImpact\":\"...\",\"severityInterpretation\":\"...\"},\"impact\":\"...\"}",
                "자연어는 한국어 중심으로 짧게 작성하고, 없는 사실은 단정하지 마세요.",
                "일본어, 중국어, 한자, 태국어, 깨진 문자는 쓰지 마세요.",
            ]

            prompt_input = "\n".join(retry_instructions)

        raw_explanation = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        explanation = get_llm_response_text(raw_explanation)
        log_llm_usage(
            logger=logger,
            stage="EXPLAIN",
            finding_id=finding_id if isinstance(finding_id, str) else None,
            input_text=prompt_input,
            response=raw_explanation,
            attempt_count=attempt + 1,
            max_output_tokens=LLM_EXPLAIN_MAX_TOKENS,
        )
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
