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
    if not normalized:
        raise ValueError(
            "Explain Chain output is empty. The LLM returned no content."
        )

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError:
        if normalized:
            validate_korean_natural_text(normalized, "explanation")
            return {
                "explanation": _legacy_explanation_sections(normalized),
                "impact": normalized,
            }
        raise ValueError(
            "Explain Chain output must be a valid JSON object."
        )

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


def generate_finding_explanation(
    finding: dict[str, Any],
    enriched_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from app.services.agent_service import format_enriched_context_for_prompt

    chain = create_explain_chain()
    finding_input = format_finding_for_explanation_llm(finding)
    enriched_text = format_enriched_context_for_prompt(enriched_context)
    if enriched_text:
        finding_input = finding_input + enriched_text
    finding_id = finding.get("id")
    last_disallowed_scripts = ""

    for attempt in range(MAX_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            retry_instructions = [
                finding_input,
                "",
                "The previous response failed validation.",
                f"Disallowed characters found: {last_disallowed_scripts or 'none'}",
                "Output only JSON.",
                'Required format: {"explanation":{"summary":"...","whyRisky":"...","abuseScenario":"...","expectedImpact":"...","severityInterpretation":"..."},"impact":"..."}',
                "Write natural-language values in Korean, keep them short, and do not assert facts not in the finding.",
                "Never use Japanese, Chinese, Hanja, Thai, or broken characters.",
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
        except ValueError as exc:
            logger.warning(
                "Explain Chain parse failed. findingId=%s attempt=%d error=%s raw_explanation=%r",
                finding_id,
                attempt + 1,
                exc,
                explanation,
            )
            if attempt == MAX_EXPLAIN_RETRIES:
                raise
            continue

    raise ValueError(
        "Explain Chain output contains disallowed foreign or broken characters: "
        f"{last_disallowed_scripts}"
    )


def compute_batch_max_tokens(
    finding_count: int,
    per_finding_tokens: int,
    cap: int,
) -> int:
    return min(int(finding_count * per_finding_tokens * 1.1), cap)


def generate_findings_explanation_batch(
    findings: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    from app.chains.explain_chain import create_batch_explain_chain
    from app.core.config import (
        LLM_BATCH_MAX_TOKENS_CAP,
        LLM_EXPLAIN_MAX_TOKENS,
        MAX_BATCH_EXPLAIN_RETRIES,
    )
    from app.services.input_service import format_findings_for_explanation_llm

    max_tokens = compute_batch_max_tokens(
        len(findings), LLM_EXPLAIN_MAX_TOKENS, LLM_BATCH_MAX_TOKENS_CAP
    )
    chain = create_batch_explain_chain(max_tokens=max_tokens)
    finding_input = format_findings_for_explanation_llm(findings)
    expected_ids = {f["id"] for f in findings}

    last_error: Exception | None = None
    for attempt in range(MAX_BATCH_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            prompt_input = (
                finding_input
                + "\n\nThe previous response failed validation. Output only the JSON array."
            )

        raw = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        text = get_llm_response_text(raw)
        log_llm_usage(
            logger=logger,
            stage="BATCH_EXPLAIN",
            finding_id=None,
            input_text=prompt_input,
            response=raw,
            attempt_count=attempt + 1,
            max_output_tokens=max_tokens,
        )

        if contains_disallowed_script(text):
            last_error = ValueError("Batch explain output contains disallowed characters.")
            continue

        try:
            return parse_batch_explain_response(text, expected_ids)
        except ValueError as exc:
            last_error = exc
            logger.warning(
                "Batch explain parse failed. attempt=%d error=%s",
                attempt + 1,
                exc,
            )

    raise ValueError(f"Batch explain failed after all retries. Last error: {last_error}")


def parse_batch_explain_response(
    response: str,
    expected_finding_ids: set[str],
) -> dict[str, dict[str, Any]]:
    normalized = _normalize_json_response(response)
    if not normalized:
        raise ValueError("Batch explain output is empty.")

    parsed = json.loads(normalized)
    if not isinstance(parsed, list):
        raise ValueError("Batch explain output must be a JSON array.")

    results: dict[str, dict[str, Any]] = {}
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("Each batch explain item must be a JSON object.")

        finding_id = item.get("findingId")
        if not isinstance(finding_id, str) or finding_id not in expected_finding_ids:
            raise ValueError(f"Invalid or unexpected findingId: {finding_id}")

        explanation = item.get("explanation")
        impact = item.get("impact")
        _validate_explanation_sections(explanation)
        if not isinstance(impact, str) or not impact.strip():
            raise ValueError(f"Batch explain for {finding_id}: impact must be a string.")
        validate_korean_natural_text(impact, f"impact[{finding_id}]")

        results[finding_id] = {"explanation": explanation, "impact": impact}

    missing = expected_finding_ids - set(results.keys())
    if missing:
        raise ValueError(f"Batch explain missing findings: {', '.join(sorted(missing))}")

    return results
