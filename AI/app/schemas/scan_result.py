from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FindingPatchContext(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    operation: Literal["replace", "append"] | None = None
    old_text: str | None = Field(default=None, alias="oldText")
    expected_file_hash: str = Field(alias="expectedFileHash")

    @field_validator("old_text")
    @classmethod
    def validate_optional_old_text(cls, value: str | None) -> str | None:
        if value is not None and (not isinstance(value, str) or not value):
            raise ValueError("must be a non-empty string when provided")
        return value

    @field_validator("expected_file_hash")
    @classmethod
    def validate_expected_file_hash(cls, value: str) -> str:
        if not isinstance(value, str) or not value.startswith("sha256:"):
            raise ValueError("must start with sha256:")
        return value


class ScanFinding(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    rule_id: str = Field(alias="ruleId")
    source: str
    severity: str
    file: str | None = None
    line: int | None = None
    title: str
    masked_evidence: str | None = Field(default=None, alias="maskedEvidence")
    target: str | None = None
    evidence: str | None = None
    patch_context: FindingPatchContext | None = Field(
        default=None,
        alias="patchContext",
    )

    @field_validator("id", "rule_id", "source", "severity", "title")
    @classmethod
    def validate_non_empty_string(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")
        return value

    @field_validator("file", "masked_evidence", "target", "evidence")
    @classmethod
    def validate_optional_non_empty_string(cls, value: str | None) -> str | None:
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ValueError("must be a non-empty string when provided")
        return value

    @model_validator(mode="after")
    def validate_finding_shape(self):
        is_server_audit = self.source == "server-audit" or self.target is not None
        if is_server_audit:
            if not self.target:
                raise ValueError("target is required for server-audit findings")
            if not self.evidence and not self.masked_evidence:
                raise ValueError(
                    "evidence or maskedEvidence is required for server-audit findings"
                )
            return self

        if not self.file:
            raise ValueError("file is required")
        if self.masked_evidence is None:
            raise ValueError("maskedEvidence is required")
        return self


class ScanResult(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    schema_version: Literal["0.1"] = Field(alias="schemaVersion")
    scan_id: str | None = Field(default=None, alias="scanId")
    audit_id: str | None = Field(default=None, alias="auditId")
    source: str
    scanned_at: str | None = Field(default=None, alias="scannedAt")
    generated_at: str | None = Field(default=None, alias="generatedAt")
    analysis_status: Literal["SUCCESS", "PARTIAL", "PARTIAL_SUCCESS", "FAILED"] | None = Field(
        default=None,
        alias="analysisStatus",
    )
    findings: list[Any]

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")
        return value

    @field_validator("scan_id", "audit_id")
    @classmethod
    def validate_uuid_v4_string(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            scan_id = UUID(value)
        except ValueError as exc:
            raise ValueError("must be a valid UUID") from exc

        if scan_id.version != 4:
            raise ValueError("must be a valid UUID v4")

        return value

    @field_validator("scanned_at", "generated_at")
    @classmethod
    def validate_iso8601_datetime(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not isinstance(value, str) or not value.strip():
            raise ValueError("must be a non-empty string")

        if "T" not in value:
            raise ValueError("must be an ISO 8601 datetime")

        normalized = value.replace("Z", "+00:00")
        try:
            datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError("must be an ISO 8601 datetime") from exc

        return value

    @model_validator(mode="after")
    def validate_scan_result_shape(self):
        is_server_audit = self.source == "server-audit" or self.audit_id is not None
        if is_server_audit:
            if not self.audit_id:
                raise ValueError("auditId is required for server-audit input")
            if not self.generated_at:
                raise ValueError("generatedAt is required for server-audit input")
            return self

        if not self.scan_id:
            raise ValueError("scanId is required for project scan input")
        if not self.scanned_at:
            raise ValueError("scannedAt is required for project scan input")
        if self.analysis_status is None:
            raise ValueError("analysisStatus is required for project scan input")
        return self
