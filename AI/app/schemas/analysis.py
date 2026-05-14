from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

class AnalysisRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scan_result_path: str = "data/scan_result.json"
    analysis_result_path: str = "data/analysis_result.json"
    scan_result: dict[str, Any] | None = None
    task_id: int | None = Field(default=None, alias="taskId")
    agent_id: int | None = Field(default=None, alias="agentId")
    project_id: int | None = Field(default=None, alias="projectId")
    scan_id: int | None = Field(default=None, alias="scanId")
    scan_type: Literal["PROJECT_FILE", "SERVER_AUDIT"] | None = Field(
        default=None,
        alias="scanType",
    )
    raw_result_path: str | None = Field(default=None, alias="rawResultPath")
    analysis_result_s3_path: str | None = Field(
        default=None,
        alias="analysisResultPath",
    )


class AnalysisResultCallbackRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: int = Field(alias="taskId")
    status: Literal["RUNNING", "DONE", "FAILED"] = "DONE"
    progress_step: str | None = Field(default=None, alias="progressStep")
    stage: str | None = None
    error_code: str | None = Field(default=None, alias="errorCode")
    failure_reason: str | None = Field(default=None, alias="failureReason")
    analysis_result_path: str | None = Field(default=None, alias="analysisResultPath")
    started_at: str | None = Field(default=None, alias="startedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    last_updated_at: str | None = Field(default=None, alias="lastUpdatedAt")

    @model_validator(mode="after")
    def validate_callback_contract(self):
        if self.status == "DONE" and not self.analysis_result_path:
            raise ValueError("analysisResultPath is required when status is DONE.")
        if self.status == "FAILED" and not self.error_code:
            raise ValueError("errorCode is required when status is FAILED.")
        if self.status == "FAILED" and not self.failure_reason:
            raise ValueError("failureReason is required when status is FAILED.")
        return self


class AnalysisResponse(BaseModel):
    status: str
    error_code: str | None = Field(default=None, exclude=True)
    message: str | None = None
    stage: str | None = None
    finding_id: str | None = None
    scan_result_path: str
    analysis_result_path: str | None = None
    finding_count: int = 0
    valid_finding_count: int = 0
    invalid_finding_count: int = 0
    result_count: int = 0
    invalid_findings: list[dict] = Field(default_factory=list)


class AnalysisErrorResponse(BaseModel):
    status: str = "failed"
    error_code: str
    message: str
    stage: str
    finding_id: str | None = None
    scan_result_path: str
    analysis_result_path: str | None = None
    finding_count: int = 0
    valid_finding_count: int = 0
    invalid_finding_count: int = 0
    result_count: int = 0
    invalid_findings: list[dict] = Field(default_factory=list)
