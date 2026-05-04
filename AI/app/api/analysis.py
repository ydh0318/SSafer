from fastapi import APIRouter

from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis_service import analyze_scan_result

router = APIRouter(tags=["analysis"])


@router.post("/analyze", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest):
    return analyze_scan_result(request)


@router.post("/analysis", response_model=AnalysisResponse, include_in_schema=False)
def analyze_legacy(request: AnalysisRequest):
    return analyze_scan_result(request)
