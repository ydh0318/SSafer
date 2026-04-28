from typing import Any


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
