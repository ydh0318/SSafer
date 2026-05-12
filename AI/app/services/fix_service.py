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
            "Retry because the previous fix JSON failed validation.",
            f"Validation error: {error_message}",
            "Return only one valid JSON object. Do not use Markdown fences.",
            "Always include: summary, priority, recommendedActions, codeGuidance, verification, cautions.",
            "priority must be high, medium, or low.",
            "recommendedActions must contain 2 to 5 non-empty strings.",
            "cautions must contain 1 to 3 non-empty strings.",
            "Omit patches when finding.patchContext is missing.",
            "If replace patches are included, each patch must include patchId, findingId, operation, filePath, oldText, newText, and expectedFileHash.",
            "If append patches are included, each patch must include patchId, findingId, operation, filePath, newText, and expectedFileHash, and must omit oldText.",
            "patches[].operation must be replace or append.",
            "patches[].filePath must equal finding.filePath and use forward slashes.",
            "patches[].expectedFileHash must start with sha256:.",
            "For replace patches, copy patchContext.oldText to oldText exactly.",
            "For append patches, use only Dockerfile targets where appending a complete instruction is safe.",
            "Do not use append for docker-compose YAML.",
            "Do not include masked values such as ***MASKED***, [MASKED], or <MASKED> in oldText or newText.",
            "If target file, exact oldText, or safe newText is uncertain, omit the patches key.",
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
