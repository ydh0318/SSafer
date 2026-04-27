from app.loaders.scan_loader import (
    extract_findings,
    load_scan_result,
    validate_findings_required_fields,
)
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.input_service import format_findings_for_llm


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    scan_result = load_scan_result(request.scan_result_path)
    findings = extract_findings(scan_result)
    validate_findings_required_fields(findings)
    llm_inputs = format_findings_for_llm(findings)

    return AnalysisResponse(
        status="prepared",
        message=(
            "scan_result.json loaded, validated, and converted. "
            f"findings={len(findings)}"
        ),
        scan_result_path=request.scan_result_path,
        finding_count=len(findings),
        llm_input_count=len(llm_inputs),
    )
