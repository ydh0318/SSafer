from typing import Any


def format_finding_for_llm(finding: dict[str, Any]) -> str:
    line = finding["line"] if finding["line"] is not None else "N/A"
    file_path = finding.get("filePath") or "N/A"
    target_files = finding.get("targetFiles")
    if isinstance(target_files, list) and target_files:
        target_files_text = ", ".join(str(value) for value in target_files)
    else:
        target_files_text = "N/A"

    return "\n".join(
        [
            f"Finding ID: {finding['id']}",
            f"Rule ID: {finding['ruleId']}",
            f"Source: {finding['source']}",
            f"Severity: {finding['severity']}",
            f"Display file: {finding['file']}",
            f"filePath: {file_path}",
            f"targetFiles: {target_files_text}",
            f"Line: {line}",
            f"Title: {finding['title']}",
            "Evidence:",
            finding["maskedEvidence"],
        ]
    )


def format_findings_for_llm(findings: list[dict[str, Any]]) -> list[str]:
    return [format_finding_for_llm(finding) for finding in findings]
