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


class FindingAnalysisError(RuntimeError):
    def __init__(self, finding_id: str, stage: str, message: str):
        super().__init__(message)
        self.finding_id = finding_id
        self.stage = stage
        self.message = message


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
    finding_id = finding["id"]

    try:
        explanation = generate_finding_explanation(finding)
    except Exception as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
        ) from exc

    try:
        fix = generate_finding_fix(finding)
    except Exception as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
        ) from exc

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
    try:
        scan_result = load_scan_result(scan_result_path)
        findings = extract_findings(scan_result)
        validate_findings_required_fields(findings)
    except Exception as exc:
        return {
            "status": "failed",
            "stage": "input",
            "scan_result_path": scan_result_path,
            "analysis_result_path": output_path,
            "message": str(exc),
        }

    try:
        structured_results = analyze_findings(findings)
    except FindingAnalysisError as exc:
        return {
            "status": "failed",
            "stage": exc.stage,
            "finding_id": exc.finding_id,
            "scan_result_path": scan_result_path,
            "analysis_result_path": output_path,
            "finding_count": len(findings),
            "message": exc.message,
        }
    except Exception as exc:
        return {
            "status": "failed",
            "stage": "analysis",
            "scan_result_path": scan_result_path,
            "analysis_result_path": output_path,
            "finding_count": len(findings),
            "message": str(exc),
        }

    try:
        analysis_result = build_analysis_result_from_results(
            scan_result=scan_result,
            structured_results=structured_results,
        )
        saved_path = save_analysis_result(analysis_result, output_path)
    except Exception as exc:
        return {
            "status": "failed",
            "stage": "output",
            "scan_result_path": scan_result_path,
            "analysis_result_path": output_path,
            "finding_count": len(findings),
            "result_count": len(structured_results),
            "message": str(exc),
        }

    return {
        "status": "completed",
        "scan_result_path": scan_result_path,
        "analysis_result_path": str(saved_path),
        "finding_count": len(findings),
        "result_count": analysis_result["resultCount"],
    }
