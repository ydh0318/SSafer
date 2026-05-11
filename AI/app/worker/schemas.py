from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScanRequestMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_type: str = Field(alias="messageType")
    message_version: int = Field(alias="messageVersion")
    task_type: str = Field(alias="taskType")
    task_id: int = Field(alias="taskId")
    agent_id: int = Field(alias="agentId")
    project_id: int = Field(alias="projectId")
    scan_id: int = Field(alias="scanId")
    scan_type: Literal["PROJECT_FILE", "SERVER_AUDIT"] = Field(alias="scanType")
    raw_result_path: str = Field(alias="rawResultPath")
    result_count: int | None = Field(default=None, alias="resultCount")
    tool: str | None = None
    tool_version: str | None = Field(default=None, alias="toolVersion")
    payload_hash: str | None = Field(default=None, alias="payloadHash")
    queued_at: str | None = Field(default=None, alias="queuedAt")

    @model_validator(mode="after")
    def validate_scan_request_contract(self):
        if self.message_type != "SCAN_REQUEST":
            raise ValueError("messageType must be SCAN_REQUEST.")
        if self.message_version != 2:
            raise ValueError("messageVersion must be 2.")
        if self.task_type != "SCAN_REQUEST":
            raise ValueError("taskType must be SCAN_REQUEST.")
        if not self.raw_result_path.startswith("s3://"):
            raise ValueError("rawResultPath must be an s3:// URI.")
        return self


class FastApiAnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: int = Field(alias="taskId")
    agent_id: int = Field(alias="agentId")
    project_id: int = Field(alias="projectId")
    scan_id: int = Field(alias="scanId")
    raw_result_path: str = Field(alias="rawResultPath")
    analysis_result_path: str = Field(alias="analysisResultPath")


class FastApiAnalyzeResponse(BaseModel):
    status: str
    message: str | None = None
    stage: str | None = None
    error_code: str | None = None
    finding_id: str | None = None
    scan_result_path: str
    analysis_result_path: str | None = None
    finding_count: int = 0
    valid_finding_count: int = 0
    invalid_finding_count: int = 0
    result_count: int = 0
    invalid_findings: list[dict[str, Any]] = Field(default_factory=list)

    @property
    def succeeded(self) -> bool:
        return self.status == "completed"


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
        if self.status == "FAILED" and not self.failure_reason:
            raise ValueError("failureReason is required when status is FAILED.")
        if self.status == "FAILED" and not self.error_code:
            raise ValueError("errorCode is required when status is FAILED.")
        return self
