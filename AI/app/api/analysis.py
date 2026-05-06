from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.analysis import (
    AnalysisErrorResponse,
    AnalysisRequest,
    AnalysisResponse,
)
from app.core.analysis_errors import (
    get_error_code_for_stage,
    get_http_status_for_stage,
)
from app.services.analysis_service import analyze_scan_result

router = APIRouter(tags=["analysis"])


def build_error_response(response: AnalysisResponse) -> JSONResponse:
    stage = response.stage or "analysis"
    error = AnalysisErrorResponse(
        error_code=response.error_code or get_error_code_for_stage(stage),
        message=response.message or "Analysis failed.",
        stage=stage,
        finding_id=response.finding_id,
        scan_result_path=response.scan_result_path,
        analysis_result_path=response.analysis_result_path,
        finding_count=response.finding_count,
        valid_finding_count=response.valid_finding_count,
        invalid_finding_count=response.invalid_finding_count,
        result_count=response.result_count,
        invalid_findings=response.invalid_findings,
    )
    return JSONResponse(
        status_code=get_http_status_for_stage(stage),
        content=error.model_dump(),
    )


def handle_analysis_request(request: AnalysisRequest) -> AnalysisResponse | JSONResponse:
    response = analyze_scan_result(request)
    if response.status == "failed":
        return build_error_response(response)
    return response


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    responses={
        400: {"model": AnalysisErrorResponse},
        500: {"model": AnalysisErrorResponse},
        502: {"model": AnalysisErrorResponse},
    },
)
def analyze(request: AnalysisRequest):
    return handle_analysis_request(request)


@router.post("/analysis", response_model=AnalysisResponse, include_in_schema=False)
def analyze_legacy(request: AnalysisRequest):
    return handle_analysis_request(request)
