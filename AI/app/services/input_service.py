from typing import Any


def _base_finding_lines(finding: dict[str, Any]) -> list[str]:
    line = finding.get("line") if finding.get("line") is not None else "N/A"
    target = finding.get("target") or "N/A"
    file_display = finding.get("file") or target
    file_path = finding.get("filePath") or "N/A"
    target_files = finding.get("targetFiles")
    if isinstance(target_files, list) and target_files:
        target_files_text = ", ".join(str(value) for value in target_files)
    else:
        target_files_text = "N/A"
    evidence = finding.get("maskedEvidence") or finding.get("evidence") or "N/A"
    scan_type = finding.get("scanType") or "PROJECT_FILE"

    return [
        f"Finding ID: {finding['id']}",
        f"Scan Type: {scan_type}",
        f"Rule ID: {finding['ruleId']}",
        f"Source: {finding['source']}",
        f"Severity: {finding['severity']}",
        f"Display file: {file_display}",
        f"Target: {target}",
        f"filePath: {file_path}",
        f"targetFiles: {target_files_text}",
        f"Line: {line}",
        f"Title: {finding['title']}",
        "Evidence:",
        evidence,
    ]


def format_finding_for_explanation_llm(finding: dict[str, Any]) -> str:
    return "\n".join(_base_finding_lines(finding))


def format_finding_for_fix_llm(finding: dict[str, Any]) -> str:
    scan_type = finding.get("scanType") or "PROJECT_FILE"
    patch_context = finding.get("patchContext")
    if isinstance(patch_context, dict):
        operation = patch_context.get("operation")
        operation_text = operation if isinstance(operation, str) and operation else "N/A"
        old_text = patch_context.get("oldText")
        old_text_block = old_text if isinstance(old_text, str) and old_text else "N/A"
        expected_file_hash_status = (
            "available" if patch_context.get("expectedFileHash") else "missing"
        )
    else:
        operation_text = "N/A"
        old_text_block = "N/A"
        expected_file_hash_status = "N/A"

    guidance_lines: list[str] = []
    if scan_type == "SERVER_AUDIT":
        guidance_lines.extend(
            [
                "Remediation mode: operational guidance only",
                "Do not generate file patches for this finding.",
                "Focus on access restriction, service inspection, package update, privilege escalation guidance, and verification commands when relevant.",
            ]
        )

    return "\n".join(
        _base_finding_lines(finding)
        + guidance_lines
        + [
            f"patchContext.operation: {operation_text}",
            "patchContext.oldText:",
            old_text_block,
            f"patchContext.expectedFileHash: {expected_file_hash_status}",
        ]
    )


def format_finding_for_llm(finding: dict[str, Any]) -> str:
    return format_finding_for_fix_llm(finding)


def format_findings_for_llm(findings: list[dict[str, Any]]) -> list[str]:
    return [format_finding_for_llm(finding) for finding in findings]
