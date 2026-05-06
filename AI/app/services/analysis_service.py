from dataclasses import dataclass
from typing import Any

from app.loaders.scan_loader import (
    extract_findings,
    load_scan_result,
    parse_scan_result,
    split_valid_invalid_findings,
    validate_scan_result_required_fields,
)
from app.core.analysis_errors import build_standard_analysis_error
from app.core.llm import LLMCallError, LLMTimeoutError
from app.schemas.analysis import AnalysisRequest, AnalysisResponse

from app.services.explain_service import generate_finding_explanation
from app.services.fix_service import generate_finding_fix
from app.services.result_service import (
    DEFAULT_ANALYSIS_RESULT_PATH,
    build_analysis_result_from_results,
    build_structured_analysis_result,
    save_analysis_result,
    validate_finding_id_mapping,
)
from app.services.s3_service import (
    S3DownloadError,
    S3UploadError,
    download_scan_result_json_data,
    upload_analysis_result_json_data,
)


class FindingAnalysisError(RuntimeError):
    def __init__(
        self,
        finding_id: str,
        stage: str,
        message: str,
        error_code: str | None = None,
    ):
        super().__init__(message)
        self.finding_id = finding_id
        self.stage = stage
        self.message = message
        self.error_code = error_code


@dataclass(frozen=True)
class AnalysisPipelineContext:
    scan_result: dict[str, Any]
    raw_findings: list[Any]
    valid_findings: list[dict[str, Any]]
    invalid_findings: list[dict[str, Any]]


def build_failed_analysis_result(
    *,
    stage: str,
    message: str | None,
    scan_result_path: str,
    analysis_result_path: str | None,
    finding_id: str | None = None,
    finding_count: int = 0,
    valid_finding_count: int = 0,
    invalid_finding_count: int = 0,
    result_count: int = 0,
    invalid_findings: list[dict[str, Any]] | None = None,
    error_code: str | None = None,
) -> dict[str, object]:
    error = build_standard_analysis_error(
        stage=stage,
        message=message,
        error_code=error_code,
    )
    return {
        "status": error.status,
        "error_code": error.error_code,
        "stage": error.stage,
        "finding_id": finding_id,
        "scan_result_path": scan_result_path,
        "analysis_result_path": analysis_result_path,
        "finding_count": finding_count,
        "valid_finding_count": valid_finding_count,
        "invalid_finding_count": invalid_finding_count,
        "invalid_findings": invalid_findings or [],
        "result_count": result_count,
        "message": error.message,
    }


def get_s3_download_error_code(exc: S3DownloadError) -> str:
    if exc.error_code in ("NoSuchKey", "NoSuchBucket", "404", "NotFound"):
        return "RAW_RESULT_NOT_FOUND"
    return "S3_DOWNLOAD_FAILED"


def analyze_scan_result(request: AnalysisRequest) -> AnalysisResponse:
    if request.raw_result_path is not None:
        result = run_s3_analysis_pipeline(
            raw_result_path=request.raw_result_path,
            analysis_result_path=request.analysis_result_s3_path
            or request.analysis_result_path,
        )
    elif request.scan_result is None:
        result = run_analysis_pipeline(
            scan_result_path=request.scan_result_path,
            output_path=request.analysis_result_path,
        )
    else:
        result = run_analysis_pipeline_from_scan_result(
            scan_result=request.scan_result.model_dump(by_alias=True),
            scan_result_path=request.scan_result_path,
            output_path=request.analysis_result_path,
        )
    return AnalysisResponse(**result)


def run_s3_analysis_pipeline(
    raw_result_path: str,
    analysis_result_path: str,
) -> dict[str, object]:
    try:
        scan_result = parse_scan_result(download_scan_result_json_data(raw_result_path))
    except S3DownloadError as exc:
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=raw_result_path,
            analysis_result_path=analysis_result_path,
            message=str(exc),
            error_code=get_s3_download_error_code(exc),
        )
    except Exception as exc:
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=raw_result_path,
            analysis_result_path=analysis_result_path,
            message=str(exc),
        )

    return run_analysis_pipeline_from_scan_result(
        scan_result=scan_result,
        scan_result_path=raw_result_path,
        output_path=analysis_result_path,
        upload_to_s3=True,
    )


def analyze_finding(finding: dict[str, Any]) -> dict[str, Any]:
    finding_id = finding["id"]

    try:
        explanation = generate_finding_explanation(finding)
    except LLMTimeoutError as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
            error_code="LLM_TIMEOUT",
        ) from exc
    except LLMCallError as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
            error_code="LLM_CALL_FAILED",
        ) from exc
    except Exception as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
        ) from exc

    try:
        fix = generate_finding_fix(finding)
    except LLMTimeoutError as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
            error_code="LLM_TIMEOUT",
        ) from exc
    except LLMCallError as exc:
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
            error_code="LLM_CALL_FAILED",
        ) from exc
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


def prepare_analysis_pipeline_context(
    scan_result: dict[str, Any],
) -> AnalysisPipelineContext:
    validate_scan_result_required_fields(scan_result)
    raw_findings = extract_findings(scan_result)
    valid_findings, invalid_findings = split_valid_invalid_findings(raw_findings)

    return AnalysisPipelineContext(
        scan_result=scan_result,
        raw_findings=raw_findings,
        valid_findings=valid_findings,
        invalid_findings=invalid_findings,
    )


def run_analysis_pipeline(
    scan_result_path: str = "data/scan_result.json",
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
) -> dict[str, object]:
    try:
        scan_result = load_scan_result(scan_result_path)
    except Exception as exc:
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            message=str(exc),
        )

    return run_analysis_pipeline_from_scan_result(
        scan_result=scan_result,
        scan_result_path=scan_result_path,
        output_path=output_path,
    )


def run_analysis_pipeline_from_scan_result(
    scan_result: dict[str, Any],
    scan_result_path: str,
    output_path: str,
    *,
    upload_to_s3: bool = False,
) -> dict[str, object]:
    try:
        context = prepare_analysis_pipeline_context(scan_result)
    except Exception as exc:
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            message=str(exc),
        )

    try:
        structured_results = analyze_findings(context.valid_findings)
    except FindingAnalysisError as exc:
        return build_failed_analysis_result(
            stage=exc.stage,
            finding_id=exc.finding_id,
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            finding_count=len(context.raw_findings),
            valid_finding_count=len(context.valid_findings),
            invalid_finding_count=len(context.invalid_findings),
            invalid_findings=context.invalid_findings,
            message=exc.message,
            error_code=exc.error_code,
        )
    except Exception as exc:
        return build_failed_analysis_result(
            stage="analysis",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            finding_count=len(context.raw_findings),
            valid_finding_count=len(context.valid_findings),
            invalid_finding_count=len(context.invalid_findings),
            invalid_findings=context.invalid_findings,
            message=str(exc),
        )

    try:
        analysis_result = build_analysis_result_from_results(
            scan_result=context.scan_result,
            structured_results=structured_results,
        )
        validate_finding_id_mapping(context.valid_findings, analysis_result)
        if upload_to_s3:
            saved_path = upload_analysis_result_json_data(analysis_result, output_path)
        else:
            saved_path = save_analysis_result(analysis_result, output_path)
    except S3UploadError as exc:
        return build_failed_analysis_result(
            stage="output",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            finding_count=len(context.raw_findings),
            valid_finding_count=len(context.valid_findings),
            invalid_finding_count=len(context.invalid_findings),
            invalid_findings=context.invalid_findings,
            result_count=len(structured_results),
            message=str(exc),
            error_code="S3_UPLOAD_FAILED",
        )
    except Exception as exc:
        return build_failed_analysis_result(
            stage="output",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            finding_count=len(context.raw_findings),
            valid_finding_count=len(context.valid_findings),
            invalid_finding_count=len(context.invalid_findings),
            invalid_findings=context.invalid_findings,
            result_count=len(structured_results),
            message=str(exc),
        )

    return {
        "status": "completed",
        "scan_result_path": scan_result_path,
        "analysis_result_path": str(saved_path),
        "finding_count": len(context.raw_findings),
        "valid_finding_count": len(context.valid_findings),
        "invalid_finding_count": len(context.invalid_findings),
        "invalid_findings": context.invalid_findings,
        "result_count": analysis_result["resultCount"],
    }
