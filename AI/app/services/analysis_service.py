from app.loaders.scan_loader import extract_findings, load_scan_result
from app.schemas.analysis import AnalysisRequest, AnalysisResponse


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    scan_result = load_scan_result(request.scan_result_path)
    findings = extract_findings(scan_result)

    return AnalysisResponse(
        status="loaded",
        message=f"scan_result.json loaded. findings={len(findings)}",
        scan_result_path=request.scan_result_path,
        finding_count=len(findings),
    )
