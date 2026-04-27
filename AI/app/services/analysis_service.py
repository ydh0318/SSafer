from app.schemas.analysis import AnalysisRequest, AnalysisResponse


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    return AnalysisResponse(
        status="ready",
        message="Analysis endpoint is ready.",
        scan_result_path=request.scan_result_path,
    )
