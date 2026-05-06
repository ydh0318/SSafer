from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScanFinding(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    rule_id: str = Field(alias="ruleId")
    source: str
    severity: str
    file: str
    line: int | None
    title: str
    masked_evidence: str = Field(alias="maskedEvidence")

    @field_validator(
        "id",
        "rule_id",
        "source",
        "severity",
        "file",
        "title",
        "masked_evidence",
    )
    @classmethod
    def validate_non_empty_string(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")
        return value


class ScanResult(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    schema_version: Literal["0.1"] = Field(alias="schemaVersion")
    scan_id: str = Field(alias="scanId")
    source: Literal["cli"]
    scanned_at: str = Field(alias="scannedAt")
    analysis_status: Literal["SUCCESS", "PARTIAL", "FAILED"] = Field(
        alias="analysisStatus"
    )
    findings: list[Any]

    @field_validator("scan_id")
    @classmethod
    def validate_scan_id(cls, value: str) -> str:
        try:
            scan_id = UUID(value)
        except ValueError as exc:
            raise ValueError("must be a valid UUID") from exc

        if scan_id.version != 4:
            raise ValueError("must be a valid UUID v4")

        return value

    @field_validator("scanned_at")
    @classmethod
    def validate_scanned_at(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")

        if "T" not in value:
            raise ValueError("must be an ISO 8601 datetime")

        normalized = value.replace("Z", "+00:00")
        from datetime import datetime

        try:
            datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError("must be an ISO 8601 datetime") from exc

        return value
