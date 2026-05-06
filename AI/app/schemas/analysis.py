from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scan_result import ScanResult


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scan_result_path: str = "data/scan_result.json"
    analysis_result_path: str = "data/analysis_result.json"
    scan_result: ScanResult | None = None
    task_id: int | None = Field(default=None, alias="taskId")
    agent_id: int | None = Field(default=None, alias="agentId")
    project_id: int | None = Field(default=None, alias="projectId")
    scan_id: int | None = Field(default=None, alias="scanId")
    raw_result_path: str | None = Field(default=None, alias="rawResultPath")
    analysis_result_s3_path: str | None = Field(
        default=None,
        alias="analysisResultPath",
    )


class AgentTaskStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    agent_id: int = Field(alias="agentId")
    scan_id: int = Field(alias="scanId")
    status: Literal["ACKED", "RUNNING", "FAILED", "CANCELED"]
    message: str | None = None
    error_code: str | None = Field(default=None, alias="errorCode")
    occurred_at: str | None = Field(default=None, alias="occurredAt")


class AgentTaskResultRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    agent_id: int = Field(alias="agentId")
    scan_id: int = Field(alias="scanId")
    status: Literal["SUCCEEDED", "FAILED", "CANCELED"]
    analysis_result_path: str | None = Field(default=None, alias="analysisResultPath")
    finding_count: int = Field(default=0, alias="findingCount")
    valid_finding_count: int = Field(default=0, alias="validFindingCount")
    invalid_finding_count: int = Field(default=0, alias="invalidFindingCount")
    result_count: int = Field(default=0, alias="resultCount")
    error_code: str | None = Field(default=None, alias="errorCode")
    message: str | None = None
    stage: str | None = None
    retryable: bool = False
    duration_ms: int | None = Field(default=None, alias="durationMs")


class AnalysisResponse(BaseModel):
    status: str
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
