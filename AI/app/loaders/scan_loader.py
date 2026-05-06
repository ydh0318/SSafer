import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.schemas.scan_result import ScanFinding, ScanResult

REQUIRED_SCAN_RESULT_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "analysisStatus",
    "findings",
)

REQUIRED_STRING_SCAN_RESULT_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "analysisStatus",
)

SUPPORTED_SCAN_RESULT_SCHEMA_VERSIONS = ("0.1",)
ALLOWED_SCAN_RESULT_SOURCES = ("cli",)
ALLOWED_ANALYSIS_STATUSES = ("SUCCESS", "PARTIAL", "FAILED")
REQUIRED_FINDING_FIELDS = (
    "id",
    "ruleId",
    "source",
    "severity",
    "file",
    "line",
    "title",
    "maskedEvidence",
)

REQUIRED_STRING_FINDING_FIELDS = (
    "id",
    "ruleId",
    "source",
    "severity",
    "file",
    "title",
    "maskedEvidence",
)


def load_scan_result(scan_result_path: str) -> dict[str, Any]:
    path = Path(scan_result_path)

    if not path.is_absolute():
        path = Path.cwd() / path

    if not path.exists():
        raise FileNotFoundError(f"scan_result.json file not found: {path}")

    try:
        with path.open("r", encoding="utf-8-sig") as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON file: {path}") from exc

    if not isinstance(data, dict):
        raise ValueError("scan_result.json root must be a JSON object.")

    return parse_scan_result(data)


def parse_scan_result(scan_result: dict[str, Any]) -> dict[str, Any]:
    try:
        parsed = ScanResult.model_validate(scan_result)
    except ValidationError as exc:
        raise ValueError(f"Invalid scan_result.json: {exc}") from exc

    return parsed.model_dump(by_alias=True)


def parse_finding(finding: dict[str, Any], index: int) -> dict[str, Any]:
    try:
        parsed = ScanFinding.model_validate(finding)
    except ValidationError as exc:
        raise ValueError(f"findings[{index}] invalid: {exc}") from exc

    return parsed.model_dump(by_alias=True)


def _is_iso8601_datetime(value: str) -> bool:
    if "T" not in value:
        return False

    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True


def validate_scan_result_required_fields(scan_result: dict[str, Any]) -> None:
    missing_fields = [
        field for field in REQUIRED_SCAN_RESULT_FIELDS if field not in scan_result
    ]

    if missing_fields:
        raise ValueError(
            "scan_result.json missing required fields: "
            f"{', '.join(missing_fields)}"
        )

    for field in REQUIRED_STRING_SCAN_RESULT_FIELDS:
        value = scan_result[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"scan_result.json field '{field}' must be a non-empty string."
            )

    schema_version = scan_result["schemaVersion"]
    if schema_version not in SUPPORTED_SCAN_RESULT_SCHEMA_VERSIONS:
        raise ValueError(
            "scan_result.json schemaVersion must be one of: "
            f"{', '.join(SUPPORTED_SCAN_RESULT_SCHEMA_VERSIONS)}."
        )

    try:
        scan_id = UUID(scan_result["scanId"])
    except ValueError as exc:
        raise ValueError("scan_result.json scanId must be a valid UUID.") from exc
    if scan_id.version != 4:
        raise ValueError("scan_result.json scanId must be a valid UUID v4.")

    source = scan_result["source"]
    if source not in ALLOWED_SCAN_RESULT_SOURCES:
        raise ValueError(
            "scan_result.json source must be one of: "
            f"{', '.join(ALLOWED_SCAN_RESULT_SOURCES)}."
        )

    scanned_at = scan_result["scannedAt"]
    if not _is_iso8601_datetime(scanned_at):
        raise ValueError("scan_result.json scannedAt must be an ISO 8601 datetime.")

    analysis_status = scan_result["analysisStatus"]
    if analysis_status not in ALLOWED_ANALYSIS_STATUSES:
        raise ValueError(
            "scan_result.json analysisStatus must be one of: "
            f"{', '.join(ALLOWED_ANALYSIS_STATUSES)}."
        )

    if not isinstance(scan_result["findings"], list):
        raise ValueError("scan_result.json findings field must be an array.")


def extract_findings(scan_result: dict[str, Any]) -> list[Any]:
    findings = scan_result.get("findings")

    if findings is None:
        raise ValueError("scan_result.json must contain a findings field.")

    if not isinstance(findings, list):
        raise ValueError("scan_result.json findings field must be an array.")

    return findings


def validate_finding_required_fields(finding: dict[str, Any], index: int) -> None:
    missing_fields = [
        field for field in REQUIRED_FINDING_FIELDS if field not in finding
    ]

    if missing_fields:
        raise ValueError(
            f"findings[{index}] missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_STRING_FINDING_FIELDS:
        value = finding[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"findings[{index}].{field} must be a non-empty string."
            )

    line = finding["line"]
    if line is not None and not isinstance(line, int):
        raise ValueError(f"findings[{index}].line must be an integer or null.")


def validate_findings_required_fields(findings: list[dict[str, Any]]) -> None:
    for index, finding in enumerate(findings):
        validate_finding_required_fields(finding, index)


def build_invalid_finding(
    index: int,
    finding: Any,
    reason: str,
) -> dict[str, Any]:
    finding_id = None
    if isinstance(finding, dict):
        raw_finding_id = finding.get("id")
        if isinstance(raw_finding_id, str) and raw_finding_id.strip():
            finding_id = raw_finding_id

    return {
        "index": index,
        "findingId": finding_id,
        "reason": reason,
    }


def split_valid_invalid_findings(
    findings: list[Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    valid_findings: list[dict[str, Any]] = []
    invalid_findings: list[dict[str, Any]] = []

    for index, finding in enumerate(findings):
        if not isinstance(finding, dict):
            invalid_findings.append(
                build_invalid_finding(
                    index=index,
                    finding=finding,
                    reason=f"findings[{index}] must be a JSON object.",
                )
            )
            continue

        try:
            parsed_finding = parse_finding(finding, index)
        except ValueError as exc:
            invalid_findings.append(
                build_invalid_finding(
                    index=index,
                    finding=finding,
                    reason=str(exc),
                )
            )
            continue

        valid_findings.append(parsed_finding)

    return valid_findings, invalid_findings
