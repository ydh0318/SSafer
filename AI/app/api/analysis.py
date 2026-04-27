from fastapi import APIRouter

from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis_service import analyze_scan_result

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest):
    return analyze_scan_result(request)
