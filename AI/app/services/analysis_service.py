from app.loaders.scan_loader import (
    extract_findings,
    load_scan_result,
    validate_findings_required_fields,
)
from app.schemas.analysis import AnalysisRequest, AnalysisResponse


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    scan_result = load_scan_result(request.scan_result_path)
    findings = extract_findings(scan_result)
    validate_findings_required_fields(findings)

    return AnalysisResponse(
        status="validated",
        message=f"scan_result.json loaded and validated. findings={len(findings)}",
        scan_result_path=request.scan_result_path,
        finding_count=len(findings),
    )
