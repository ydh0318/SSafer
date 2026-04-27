from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.loaders.scan_loader import load_scan_result


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    scan_result = load_scan_result(request.scan_result_path)

    return AnalysisResponse(
        status="loaded",
        message=f"scan_result.json loaded. keys={len(scan_result.keys())}",
        scan_result_path=request.scan_result_path,
    )
