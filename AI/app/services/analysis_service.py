from app.loaders.scan_loader import (
    extract_findings,
    load_scan_result,
    validate_findings_required_fields,
)
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.explain_service import generate_finding_explanations
from app.services.fix_service import generate_finding_fixes
from app.services.input_service import format_findings_for_llm
from app.services.result_service import (
    DEFAULT_ANALYSIS_RESULT_PATH,
    build_analysis_result,
    save_analysis_result,
)


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


def run_analysis_pipeline(
    scan_result_path: str = "data/scan_result.json",
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
) -> dict[str, object]:
    scan_result = load_scan_result(scan_result_path)
    findings = extract_findings(scan_result)
    validate_findings_required_fields(findings)

    explanations = generate_finding_explanations(findings)
    fixes = generate_finding_fixes(findings)

    analysis_result = build_analysis_result(
        scan_result=scan_result,
        findings=findings,
        explanation_results=explanations,
        fix_results=fixes,
    )
    saved_path = save_analysis_result(analysis_result, output_path)

    return {
        "status": "completed",
        "scan_result_path": scan_result_path,
        "analysis_result_path": str(saved_path),
        "finding_count": len(findings),
        "result_count": analysis_result["resultCount"],
    }
