from typing import Any

from app.loaders.scan_loader import (
    extract_findings,
    load_scan_result,
    validate_findings_required_fields,
)
from app.schemas.analysis import AnalysisRequest, AnalysisResponse

from app.services.explain_service import generate_finding_explanation
from app.services.fix_service import generate_finding_fix
from app.services.input_service import format_findings_for_llm
from app.services.result_service import (
    DEFAULT_ANALYSIS_RESULT_PATH,
    build_analysis_result_from_results,
    build_structured_analysis_result,
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


def analyze_finding(finding: dict[str, Any]) -> dict[str, Any]:
    explanation = generate_finding_explanation(finding)
    fix = generate_finding_fix(finding)

    return build_structured_analysis_result(
        finding=finding,
        explanation=explanation,
        fix=fix,
    )


def analyze_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [analyze_finding(finding) for finding in findings]


def run_analysis_pipeline(
    scan_result_path: str = "data/scan_result.json",
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
) -> dict[str, object]:
    scan_result = load_scan_result(scan_result_path)
    findings = extract_findings(scan_result)
    validate_findings_required_fields(findings)

    structured_results = analyze_findings(findings)

    analysis_result = build_analysis_result_from_results(
        scan_result=scan_result,
        structured_results=structured_results,
    )
    saved_path = save_analysis_result(analysis_result, output_path)

    return {
        "status": "completed",
        "scan_result_path": scan_result_path,
        "analysis_result_path": str(saved_path),
        "finding_count": len(findings),
        "result_count": analysis_result["resultCount"],
    }
