import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ANALYSIS_RESULT_SCHEMA_VERSION = "0.1"
DEFAULT_ANALYSIS_RESULT_PATH = "data/analysis_result.json"


def _resolve_path(path: str) -> Path:
    resolved_path = Path(path)
    if not resolved_path.is_absolute():
        resolved_path = Path.cwd() / resolved_path
    return resolved_path


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


def validate_analysis_result(analysis_result: dict[str, Any]) -> None:
    if not isinstance(analysis_result.get("schemaVersion"), str):
        raise ValueError("analysis_result.schemaVersion must be a string.")

    if not isinstance(analysis_result.get("generatedAt"), str):
        raise ValueError("analysis_result.generatedAt must be a string.")

    result_count = analysis_result.get("resultCount")
    results = analysis_result.get("results")

    if not isinstance(result_count, int):
        raise ValueError("analysis_result.resultCount must be an integer.")

    if not isinstance(results, list):
        raise ValueError("analysis_result.results must be an array.")

    if result_count != len(results):
        raise ValueError("analysis_result.resultCount must match results length.")

    for index, result in enumerate(results):
        if not isinstance(result, dict):
            raise ValueError(f"analysis_result.results[{index}] must be an object.")

        finding_id = result.get("findingId")
        if not isinstance(finding_id, str) or not finding_id.strip():
            raise ValueError(
                f"analysis_result.results[{index}].findingId must be a string."
            )

        explanation = result.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            raise ValueError(
                f"analysis_result.results[{index}].explanation must be a string."
            )

        if not isinstance(result.get("fix"), dict):
            raise ValueError(f"analysis_result.results[{index}].fix must be an object.")


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
