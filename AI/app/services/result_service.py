from typing import Any


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
