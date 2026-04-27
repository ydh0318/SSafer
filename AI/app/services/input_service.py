from typing import Any


def format_finding_for_llm(finding: dict[str, Any]) -> str:
    line = finding["line"] if finding["line"] is not None else "N/A"

    return "\n".join(
        [
            f"탐지 ID: {finding['id']}",
            f"규칙 ID: {finding['ruleId']}",
            f"탐지 출처: {finding['source']}",
            f"심각도: {finding['severity']}",
            f"파일: {finding['file']}",
            f"줄 번호: {line}",
            f"제목: {finding['title']}",
            "근거:",
            finding["maskedEvidence"],
        ]
    )


def format_findings_for_llm(findings: list[dict[str, Any]]) -> list[str]:
    return [format_finding_for_llm(finding) for finding in findings]
