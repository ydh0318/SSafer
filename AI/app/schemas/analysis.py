from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    scan_result_path: str = "data/scan_result.json"


class AnalysisResponse(BaseModel):
    status: str
    message: str
    scan_result_path: str
    finding_count: int
    valid_finding_count: int
    invalid_finding_count: int
    llm_input_count: int
    invalid_findings: list[dict] = Field(default_factory=list)
