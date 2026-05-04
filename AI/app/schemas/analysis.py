from pydantic import BaseModel, Field

from app.schemas.scan_result import ScanResult


class AnalysisRequest(BaseModel):
    scan_result_path: str = "data/scan_result.json"
    analysis_result_path: str = "data/analysis_result.json"
    scan_result: ScanResult | None = None


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
