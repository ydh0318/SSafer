from typing import Any


def format_finding_for_llm(finding: dict[str, Any]) -> str:
    line = finding["line"] if finding["line"] is not None else "N/A"

    return "\n".join(
        [
            f"Finding ID: {finding['id']}",
            f"Rule ID: {finding['ruleId']}",
            f"Source: {finding['source']}",
            f"Severity: {finding['severity']}",
            f"File: {finding['file']}",
            f"Line: {line}",
            f"Title: {finding['title']}",
            "Evidence:",
            finding["maskedEvidence"],
        ]
    )


def format_findings_for_llm(findings: list[dict[str, Any]]) -> list[str]:
    return [format_finding_for_llm(finding) for finding in findings]
