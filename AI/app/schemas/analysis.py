from pydantic import BaseModel


class AnalysisRequest(BaseModel):
    scan_result_path: str = "data/scan_result.json"


class AnalysisResponse(BaseModel):
    status: str
    message: str
    scan_result_path: str
