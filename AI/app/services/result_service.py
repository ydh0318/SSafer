import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ANALYSIS_RESULT_SCHEMA_VERSION = "0.1"
DEFAULT_ANALYSIS_RESULT_PATH = "data/analysis_result.json"
REQUIRED_ANALYSIS_RESULT_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "generatedAt",
    "resultCount",
    "results",
)
REQUIRED_ANALYSIS_RESULT_STRING_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "generatedAt",
)
REQUIRED_RESULT_FIELDS = (
    "findingId",
    "ruleId",
    "source",
    "severity",
    "file",
    "line",
    "title",
    "maskedEvidence",
    "explanation",
    "fix",
)
REQUIRED_RESULT_STRING_FIELDS = (
    "findingId",
    "ruleId",
    "source",
    "severity",
    "file",
    "title",
    "maskedEvidence",
    "explanation",
)
REQUIRED_FIX_FIELDS = (
    "summary",
    "priority",
    "recommendedActions",
    "codeGuidance",
    "verification",
    "cautions",
)
REQUIRED_FIX_STRING_FIELDS = (
    "summary",
    "priority",
    "codeGuidance",
    "verification",
)
ALLOWED_FIX_PRIORITIES = ("high", "medium", "low")


def _resolve_path(path: str) -> Path:
    resolved_path = Path(path)
    if not resolved_path.is_absolute():
        resolved_path = Path.cwd() / resolved_path
    return resolved_path


def _is_iso8601_datetime(value: str) -> bool:
    if "T" not in value:
        return False

    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True


def _map_ai_results_by_finding_id(
    ai_results: list[dict[str, Any]],
    value_key: str,
) -> dict[str, Any]:
    mapped_results: dict[str, Any] = {}

    for ai_result in ai_results:
        finding_id = ai_result.get("finding_id")
        if not isinstance(finding_id, str) or not finding_id.strip():
            raise ValueError("AI result must contain a non-empty finding_id.")

        if finding_id in mapped_results:
            raise ValueError(f"Duplicate AI result for finding_id: {finding_id}")

        if value_key not in ai_result:
            raise ValueError(
                f"AI result for finding_id={finding_id} missing {value_key}."
            )

        mapped_results[finding_id] = ai_result[value_key]

    return mapped_results


def build_structured_analysis_result(
    finding: dict[str, Any],
    explanation: str,
    fix: dict[str, Any],
) -> dict[str, Any]:
    return {
        "findingId": finding["id"],
        "ruleId": finding["ruleId"],
        "source": finding["source"],
        "severity": finding["severity"],
        "file": finding["file"],
        "line": finding["line"],
        "title": finding["title"],
        "maskedEvidence": finding["maskedEvidence"],
        "explanation": explanation,
        "fix": fix,
    }


def build_structured_analysis_results(
    findings: list[dict[str, Any]],
    explanations: list[str],
    fixes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if len(findings) != len(explanations) or len(findings) != len(fixes):
        raise ValueError("findings, explanations, and fixes must have the same length.")

    return [
        build_structured_analysis_result(finding, explanation, fix)
        for finding, explanation, fix in zip(findings, explanations, fixes)
    ]


def build_structured_analysis_results_by_finding_id(
    findings: list[dict[str, Any]],
    explanation_results: list[dict[str, Any]],
    fix_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    explanation_by_finding_id = _map_ai_results_by_finding_id(
        explanation_results,
        "explanation",
    )
    fix_by_finding_id = _map_ai_results_by_finding_id(fix_results, "fix")

    structured_results: list[dict[str, Any]] = []
    for finding in findings:
        finding_id = finding["id"]

        if finding_id not in explanation_by_finding_id:
            raise ValueError(f"Missing explanation for finding_id: {finding_id}")

        if finding_id not in fix_by_finding_id:
            raise ValueError(f"Missing fix for finding_id: {finding_id}")

        structured_results.append(
            build_structured_analysis_result(
                finding=finding,
                explanation=explanation_by_finding_id[finding_id],
                fix=fix_by_finding_id[finding_id],
            )
        )

    return structured_results


def build_analysis_result(
    scan_result: dict[str, Any],
    findings: list[dict[str, Any]],
    explanation_results: list[dict[str, Any]],
    fix_results: list[dict[str, Any]],
) -> dict[str, Any]:
    results = build_structured_analysis_results_by_finding_id(
        findings=findings,
        explanation_results=explanation_results,
        fix_results=fix_results,
    )

    return {
        "schemaVersion": ANALYSIS_RESULT_SCHEMA_VERSION,
        "scanId": scan_result.get("scanId"),
        "source": scan_result.get("source"),
        "scannedAt": scan_result.get("scannedAt"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": len(results),
        "results": results,
    }


def build_analysis_result_from_results(
    scan_result: dict[str, Any],
    structured_results: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schemaVersion": ANALYSIS_RESULT_SCHEMA_VERSION,
        "scanId": scan_result.get("scanId"),
        "source": scan_result.get("source"),
        "scannedAt": scan_result.get("scannedAt"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": len(structured_results),
        "results": structured_results,
    }


def validate_analysis_result(analysis_result: dict[str, Any]) -> None:
    missing_fields = [
        field
        for field in REQUIRED_ANALYSIS_RESULT_FIELDS
        if field not in analysis_result
    ]
    if missing_fields:
        raise ValueError(
            "analysis_result.json missing required fields: "
            f"{', '.join(missing_fields)}"
        )

    for field in REQUIRED_ANALYSIS_RESULT_STRING_FIELDS:
        value = analysis_result[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"analysis_result.{field} must be a non-empty string."
            )

    if analysis_result["schemaVersion"] != ANALYSIS_RESULT_SCHEMA_VERSION:
        raise ValueError(
            "analysis_result.schemaVersion must be "
            f"{ANALYSIS_RESULT_SCHEMA_VERSION}."
        )

    for field in ("scannedAt", "generatedAt"):
        if not _is_iso8601_datetime(analysis_result[field]):
            raise ValueError(
                f"analysis_result.{field} must be an ISO 8601 datetime."
            )

    result_count = analysis_result.get("resultCount")
    results = analysis_result.get("results")

    if type(result_count) is not int:
        raise ValueError("analysis_result.resultCount must be an integer.")
    if result_count < 0:
        raise ValueError("analysis_result.resultCount must be greater than or equal to 0.")

    if not isinstance(results, list):
        raise ValueError("analysis_result.results must be an array.")

    if result_count != len(results):
        raise ValueError("analysis_result.resultCount must match results length.")

    for index, result in enumerate(results):
        validate_analysis_result_item(result, index)


def validate_analysis_result_item(result: Any, index: int) -> None:
    result_path = f"analysis_result.results[{index}]"

    if not isinstance(result, dict):
        raise ValueError(f"{result_path} must be an object.")

    missing_fields = [field for field in REQUIRED_RESULT_FIELDS if field not in result]
    if missing_fields:
        raise ValueError(
            f"{result_path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_RESULT_STRING_FIELDS:
        value = result[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"{result_path}.{field} must be a non-empty string."
            )

    line = result["line"]
    if line is not None and type(line) is not int:
        raise ValueError(f"{result_path}.line must be an integer or null.")

    validate_fix_schema(result["fix"], f"{result_path}.fix")


def validate_fix_schema(fix: Any, path: str = "fix") -> None:
    if not isinstance(fix, dict):
        raise ValueError(f"{path} must be an object.")

    missing_fields = [field for field in REQUIRED_FIX_FIELDS if field not in fix]
    if missing_fields:
        raise ValueError(
            f"{path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_FIX_STRING_FIELDS:
        value = fix[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}.{field} must be a non-empty string.")

    priority = fix["priority"]
    if priority not in ALLOWED_FIX_PRIORITIES:
        raise ValueError(
            f"{path}.priority must be one of: "
            f"{', '.join(ALLOWED_FIX_PRIORITIES)}."
        )

    recommended_actions = fix["recommendedActions"]
    if not isinstance(recommended_actions, list):
        raise ValueError(f"{path}.recommendedActions must be an array.")
    if not 2 <= len(recommended_actions) <= 5:
        raise ValueError(f"{path}.recommendedActions must contain 2 to 5 items.")

    cautions = fix["cautions"]
    if not isinstance(cautions, list):
        raise ValueError(f"{path}.cautions must be an array.")
    if not 1 <= len(cautions) <= 3:
        raise ValueError(f"{path}.cautions must contain 1 to 3 items.")

    for field, values in (
        ("recommendedActions", recommended_actions),
        ("cautions", cautions),
    ):
        for item_index, value in enumerate(values):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(
                    f"{path}.{field}[{item_index}] must be a non-empty string."
                )


def save_analysis_result(
    analysis_result: dict[str, Any],
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
) -> Path:
    validate_analysis_result(analysis_result)

    path = _resolve_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(analysis_result, file, ensure_ascii=False, indent=2)
        file.write("\n")

    return path


def load_analysis_result(output_path: str = DEFAULT_ANALYSIS_RESULT_PATH) -> dict[str, Any]:
    path = _resolve_path(output_path)

    try:
        with path.open("r", encoding="utf-8-sig") as file:
            analysis_result = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid analysis_result.json file: {path}") from exc

    if not isinstance(analysis_result, dict):
        raise ValueError("analysis_result.json root must be a JSON object.")

    validate_analysis_result(analysis_result)
    return analysis_result
