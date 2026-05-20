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


def _validate_fix_dict(parsed: dict[str, Any], label: str = "Fix Chain output") -> None:
    if not isinstance(parsed, dict):
        raise ValueError(f"{label} must be a JSON object.")

    missing_fields = [field for field in REQUIRED_FIX_FIELDS if field not in parsed]
    if missing_fields:
        raise ValueError(
            f"{label} missing required fields: {', '.join(missing_fields)}"
        )

    for field in ("summary", "codeGuidance", "verification"):
        value = parsed[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{label} field '{field}' must be a string.")

    priority = parsed["priority"]
    if not isinstance(priority, str) or priority not in ALLOWED_FIX_PRIORITIES:
        raise ValueError(
            f"{label} field 'priority' must be one of: "
            f"{', '.join(ALLOWED_FIX_PRIORITIES)}."
        )

    recommended_actions = parsed["recommendedActions"]
    if not isinstance(recommended_actions, list) or not 2 <= len(recommended_actions) <= 5:
        raise ValueError(
            f"{label} field 'recommendedActions' must contain 2 to 5 items."
        )

    cautions = parsed["cautions"]
    if not isinstance(cautions, list) or len(cautions) > 3:
        raise ValueError(f"{label} field 'cautions' must contain 0 to 3 items.")

    for field, values in (
        ("recommendedActions", recommended_actions),
        ("cautions", cautions),
    ):
        if not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError(
                f"{label} field '{field}' must contain non-empty strings."
            )

    try:
        validate_fix_schema(parsed, label, strict_patch_metadata=False)
    except ValueError as exc:
        raise ValueError(f"{label} failed schema validation: {exc}") from exc


def parse_fix_response(response: str) -> dict[str, Any]:
    normalized = _normalize_json_response(response)

    try:
        parsed = json.loads(normalized)
    except json.JSONDecodeError as exc:
        raise ValueError("Fix Chain output must be a valid JSON object.") from exc

    _validate_fix_dict(parsed)
    return parsed


def build_fix_retry_prompt(finding_input: str, error_message: str) -> str:
    return "\n".join(
        [
            finding_input,
            "",
            "The previous fix JSON failed validation. Please regenerate.",
            f"Validation error: {error_message}",
            "Output only a JSON object.",
            "Required fields: summary, priority, recommendedActions, codeGuidance, verification, cautions.",
            "priority must be one of: critical, high, medium, low.",
            "recommendedActions: string array with 2-5 items. cautions: string array with 0-3 items.",
            "Use empty array [] for cautions if nothing comes to mind.",
            "Write all natural-language values in Korean.",
            "If source is server-audit or Scan Type is SERVER_AUDIT, do not generate patches; focus on operational guidance.",
            "Include patches only when safe and patchContext is available.",
            "Use finding.patchContext.operation exactly for operation.",
            "If operation is replace, copy patchContext.oldText verbatim; do not rewrite.",
            "If operation is append, do not create oldText.",
            "Each patch must contain only operation, oldText, newText. Do not output filePath, expectedFileHash, patchId, or findingId.",
        ]
    )


def generate_finding_fix(
    finding: dict[str, Any],
    enriched_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from app.services.agent_service import format_enriched_context_for_prompt

    chain = create_fix_chain()
    finding_input = format_finding_for_fix_llm(finding)
    enriched_text = format_enriched_context_for_prompt(enriched_context)
    if enriched_text:
        finding_input = finding_input + enriched_text
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


def generate_findings_fix_batch(
    findings: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    from app.chains.fix_chain import create_batch_fix_chain
    from app.core.config import (
        LLM_BATCH_MAX_TOKENS_CAP,
        LLM_FIX_MAX_TOKENS,
        MAX_BATCH_FIX_RETRIES,
    )
    from app.services.explain_service import compute_batch_max_tokens
    from app.services.input_service import format_findings_for_fix_llm

    max_tokens = compute_batch_max_tokens(
        len(findings), LLM_FIX_MAX_TOKENS, LLM_BATCH_MAX_TOKENS_CAP
    )
    chain = create_batch_fix_chain(max_tokens=max_tokens)
    finding_input = format_findings_for_fix_llm(findings)
    expected_ids = {f["id"] for f in findings}

    last_error: Exception | None = None
    for attempt in range(MAX_BATCH_FIX_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0 and last_error is not None:
            prompt_input = (
                finding_input
                + f"\n\nThe previous response failed validation. Error: {last_error}\n"
                "Output only the JSON array."
            )

        raw = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
        text = get_llm_response_text(raw)
        log_llm_usage(
            logger=logger,
            stage="BATCH_FIX",
            finding_id=None,
            input_text=prompt_input,
            response=raw,
            attempt_count=attempt + 1,
            max_output_tokens=max_tokens,
        )

        if contains_disallowed_script(text):
            last_error = ValueError("Batch fix output contains disallowed characters.")
            continue

        try:
            return parse_batch_fix_response(text, expected_ids)
        except ValueError as exc:
            last_error = exc
            logger.warning(
                "Batch fix parse failed. attempt=%d error=%s",
                attempt + 1,
                exc,
            )

    raise ValueError(f"Batch fix failed after all retries. Last error: {last_error}")


def parse_batch_fix_response(
    response: str,
    expected_finding_ids: set[str],
) -> dict[str, dict[str, Any]]:
    normalized = _normalize_json_response(response)
    if not normalized:
        raise ValueError("Batch fix output is empty.")

    parsed = json.loads(normalized)
    if not isinstance(parsed, list):
        raise ValueError("Batch fix output must be a JSON array.")

    results: dict[str, dict[str, Any]] = {}
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("Each batch fix item must be a JSON object.")

        finding_id = item.pop("findingId", None)
        if not isinstance(finding_id, str) or finding_id not in expected_finding_ids:
            raise ValueError(f"Invalid or unexpected findingId: {finding_id}")

        _validate_fix_dict(item, label=f"Batch fix[{finding_id}]")
        results[finding_id] = item

    missing = expected_finding_ids - set(results.keys())
    if missing:
        raise ValueError(f"Batch fix missing findings: {', '.join(sorted(missing))}")

    return results
