from dataclasses import dataclass
import logging
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
from app.core.logging_utils import elapsed_ms, log_with_fields, monotonic_ms
from app.schemas.analysis import AnalysisRequest, AnalysisResponse

from app.services.explain_service import (
    generate_finding_explanation,
    generate_findings_explanation_batch,
)
from app.services.fix_service import generate_finding_fix, generate_findings_fix_batch
from app.services.reference_service import fetch_findings_references
from app.services.result_service import (
    DEFAULT_ANALYSIS_RESULT_PATH,
    build_analysis_result_from_results,
    build_structured_analysis_result,
    normalize_analysis_result_patches,
    save_analysis_result,
    validate_finding_id_mapping,
)
from app.services.s3_service import (
    S3DownloadError,
    S3UploadError,
    download_scan_result_json_data,
    upload_analysis_result_json_data,
)
from app.services.verify_service import verify_and_maybe_regenerate


logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


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


def build_analysis_log_fields(request: AnalysisRequest) -> dict[str, Any]:
    return {
        "scanId": request.scan_id,
        "taskId": request.task_id,
        "agentId": request.agent_id,
        "projectId": request.project_id,
        "scanType": request.scan_type,
    }


def log_analysis_step(
    message: str,
    *,
    stage: str,
    started_ms: int,
    level: int = logging.INFO,
    log_fields: dict[str, Any] | None = None,
    **fields: Any,
) -> None:
    log_with_fields(
        logger,
        level,
        message,
        **(log_fields or {}),
        stage=stage,
        durationMs=elapsed_ms(started_ms),
        **fields,
    )


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
    started_ms = monotonic_ms()
    log_fields = build_analysis_log_fields(request)
    log_with_fields(
        logger,
        logging.INFO,
        "FastAPI analysis started.",
        **log_fields,
        stage="ANALYZE_REQUEST",
        status="RUNNING",
    )

    try:
        if request.raw_result_path is not None:
            result = run_s3_analysis_pipeline(
                raw_result_path=request.raw_result_path,
                analysis_result_path=request.analysis_result_s3_path
                or request.analysis_result_path,
                scan_type=request.scan_type,
                log_fields=log_fields,
            )
        elif request.scan_result is None:
            result = run_analysis_pipeline(
                scan_result_path=request.scan_result_path,
                output_path=request.analysis_result_path,
                scan_type=request.scan_type,
                log_fields=log_fields,
            )
        else:
            result = run_analysis_pipeline_from_scan_result(
                scan_result=request.scan_result,
                scan_result_path=request.scan_result_path,
                output_path=request.analysis_result_path,
                scan_type=request.scan_type,
                log_fields=log_fields,
            )
    except Exception:
        log_with_fields(
            logger,
            logging.ERROR,
            "FastAPI analysis failed with unhandled exception.",
            scanId=request.scan_id,
            taskId=request.task_id,
            agentId=request.agent_id,
            projectId=request.project_id,
            stage="TASK_FAILED",
            status="failed",
            errorCode="UNKNOWN_ERROR",
            durationMs=elapsed_ms(started_ms),
        )
        raise

    status = str(result.get("status") or "")
    if status == "failed":
        log_with_fields(
            logger,
            logging.ERROR,
            "FastAPI analysis failed.",
            scanId=request.scan_id,
            taskId=request.task_id,
            agentId=request.agent_id,
            projectId=request.project_id,
            stage=result.get("stage") or "TASK_FAILED",
            status=status,
            errorCode=result.get("error_code"),
            durationMs=elapsed_ms(started_ms),
        )
    else:
        log_with_fields(
            logger,
            logging.INFO,
            "FastAPI analysis completed.",
            scanId=request.scan_id,
            taskId=request.task_id,
            agentId=request.agent_id,
            projectId=request.project_id,
            stage="TASK_COMPLETED",
            status=status,
            durationMs=elapsed_ms(started_ms),
        )
    return AnalysisResponse(**result)


def run_s3_analysis_pipeline(
    raw_result_path: str,
    analysis_result_path: str,
    *,
    scan_type: str | None = None,
    log_fields: dict[str, Any] | None = None,
) -> dict[str, object]:
    download_started_ms = monotonic_ms()
    try:
        scan_result = parse_scan_result(
            download_scan_result_json_data(raw_result_path),
            scan_type_hint=scan_type,
        )
        log_analysis_step(
            "FastAPI S3 raw result downloaded.",
            stage="S3_DOWNLOAD",
            started_ms=download_started_ms,
            log_fields=log_fields,
            rawResultPath=raw_result_path,
        )
    except S3DownloadError as exc:
        log_analysis_step(
            "FastAPI S3 raw result download failed.",
            stage="S3_DOWNLOAD",
            started_ms=download_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            rawResultPath=raw_result_path,
            errorCode=get_s3_download_error_code(exc),
        )
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=raw_result_path,
            analysis_result_path=analysis_result_path,
            message=str(exc),
            error_code=get_s3_download_error_code(exc),
        )
    except Exception as exc:
        log_analysis_step(
            "FastAPI S3 raw result download failed.",
            stage="S3_DOWNLOAD",
            started_ms=download_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            rawResultPath=raw_result_path,
        )
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
        scan_type=scan_type,
        upload_to_s3=True,
        log_fields=log_fields,
    )


def analyze_finding(
    finding: dict[str, Any],
    *,
    log_fields: dict[str, Any] | None = None,
    finding_index: int | None = None,
    finding_total: int | None = None,
) -> dict[str, Any]:
    finding_id = finding["id"]
    scan_type = finding.get("scanType")

    finding_started_ms = monotonic_ms()
    log_with_fields(
        logger,
        logging.INFO,
        "FastAPI finding analysis started.",
        **(log_fields or {}),
        stage="FINDING_ANALYSIS",
        findingId=finding_id,
        findingIndex=finding_index,
        findingTotal=finding_total,
    )

    explain_started_ms = monotonic_ms()
    try:
        explanation = generate_finding_explanation(finding)
        log_analysis_step(
            "FastAPI finding explanation completed.",
            stage="EXPLAIN",
            started_ms=explain_started_ms,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
        )
    except LLMTimeoutError as exc:
        log_analysis_step(
            "FastAPI finding explanation timed out.",
            stage="EXPLAIN",
            started_ms=explain_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
            errorCode="LLM_TIMEOUT",
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
            error_code="LLM_TIMEOUT",
        ) from exc
    except LLMCallError as exc:
        log_analysis_step(
            "FastAPI finding explanation failed.",
            stage="EXPLAIN",
            started_ms=explain_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
            errorCode="LLM_CALL_FAILED",
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
            error_code="LLM_CALL_FAILED",
        ) from exc
    except Exception as exc:
        log_analysis_step(
            "FastAPI finding explanation failed.",
            stage="EXPLAIN",
            started_ms=explain_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="explain",
            message=str(exc),
        ) from exc

    fix_started_ms = monotonic_ms()
    try:
        fix = generate_finding_fix(finding)
        if scan_type == "SERVER_AUDIT":
            fix.pop("patch", None)
            fix.pop("patches", None)
        log_analysis_step(
            "FastAPI finding fix completed.",
            stage="FIX",
            started_ms=fix_started_ms,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
        )
    except LLMTimeoutError as exc:
        log_analysis_step(
            "FastAPI finding fix timed out.",
            stage="FIX",
            started_ms=fix_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
            errorCode="LLM_TIMEOUT",
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
            error_code="LLM_TIMEOUT",
        ) from exc
    except LLMCallError as exc:
        log_analysis_step(
            "FastAPI finding fix failed.",
            stage="FIX",
            started_ms=fix_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
            errorCode="LLM_CALL_FAILED",
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
            error_code="LLM_CALL_FAILED",
        ) from exc
    except Exception as exc:
        log_analysis_step(
            "FastAPI finding fix failed.",
            stage="FIX",
            started_ms=fix_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
        )
        raise FindingAnalysisError(
            finding_id=finding_id,
            stage="fix",
            message=str(exc),
        ) from exc

    verify_started_ms = monotonic_ms()
    fix, verify_result = verify_and_maybe_regenerate(finding, fix)
    verified_payload = None if verify_result.stage == "skipped" else verify_result.to_dict()
    if verified_payload is not None:
        log_analysis_step(
            "FastAPI finding verify completed.",
            stage="VERIFY",
            started_ms=verify_started_ms,
            log_fields=log_fields,
            findingId=finding_id,
            findingIndex=finding_index,
            findingTotal=finding_total,
            verifyPassed=verify_result.passed,
            verifyStage=verify_result.stage,
            verifyRetries=verify_result.retries,
        )

    result = build_structured_analysis_result(
        finding=finding,
        explanation=explanation,
        fix=fix,
        verified=verified_payload,
    )
    log_analysis_step(
        "FastAPI finding analysis completed.",
        stage="FINDING_ANALYSIS",
        started_ms=finding_started_ms,
        log_fields=log_fields,
        findingId=finding_id,
        findingIndex=finding_index,
        findingTotal=finding_total,
    )
    return result


def analyze_findings(
    findings: list[dict[str, Any]],
    *,
    log_fields: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    finding_total = len(findings)

    if finding_total <= 1:
        return [
            analyze_finding(
                finding,
                log_fields=log_fields,
                finding_index=index,
                finding_total=finding_total,
            )
            for index, finding in enumerate(findings, start=1)
        ]

    from app.core.config import MAX_FINDINGS_PER_BATCH

    batches = _chunk_findings(findings, MAX_FINDINGS_PER_BATCH)
    all_results: list[dict[str, Any]] = []
    for batch in batches:
        batch_results = _analyze_findings_batch(batch, log_fields=log_fields)
        all_results.extend(batch_results)
    return all_results


def _chunk_findings(
    findings: list[dict[str, Any]],
    max_per_batch: int,
) -> list[list[dict[str, Any]]]:
    if max_per_batch <= 0 or len(findings) <= max_per_batch:
        return [findings]
    return [
        findings[i : i + max_per_batch]
        for i in range(0, len(findings), max_per_batch)
    ]


def _analyze_findings_batch(
    findings: list[dict[str, Any]],
    *,
    log_fields: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    finding_total = len(findings)

    explain_started_ms = monotonic_ms()
    try:
        explanations_by_id = generate_findings_explanation_batch(findings)
        log_analysis_step(
            "Batch explain completed.",
            stage="BATCH_EXPLAIN",
            started_ms=explain_started_ms,
            log_fields=log_fields,
            findingCount=finding_total,
        )
    except (LLMTimeoutError, LLMCallError, ValueError):
        log_analysis_step(
            "Batch explain failed, falling back to per-finding.",
            stage="BATCH_EXPLAIN_FALLBACK",
            started_ms=explain_started_ms,
            level=logging.WARNING,
            log_fields=log_fields,
            findingCount=finding_total,
        )
        return _analyze_findings_sequential(findings, log_fields=log_fields)

    fix_started_ms = monotonic_ms()
    try:
        fixes_by_id = generate_findings_fix_batch(findings)
        log_analysis_step(
            "Batch fix completed.",
            stage="BATCH_FIX",
            started_ms=fix_started_ms,
            log_fields=log_fields,
            findingCount=finding_total,
        )
    except (LLMTimeoutError, LLMCallError, ValueError):
        log_analysis_step(
            "Batch fix failed, falling back to per-finding.",
            stage="BATCH_FIX_FALLBACK",
            started_ms=fix_started_ms,
            level=logging.WARNING,
            log_fields=log_fields,
            findingCount=finding_total,
        )
        return _analyze_findings_sequential(findings, log_fields=log_fields)

    results = []
    for finding in findings:
        fid = finding["id"]
        scan_type = finding.get("scanType")
        explanation = explanations_by_id[fid]
        fix = fixes_by_id[fid]
        if scan_type == "SERVER_AUDIT":
            fix.pop("patch", None)
            fix.pop("patches", None)
        fix, verify_result = verify_and_maybe_regenerate(finding, fix)
        verified_payload = (
            None if verify_result.stage == "skipped" else verify_result.to_dict()
        )
        results.append(
            build_structured_analysis_result(
                finding=finding,
                explanation=explanation,
                fix=fix,
                verified=verified_payload,
            )
        )
    return results


def _analyze_findings_sequential(
    findings: list[dict[str, Any]],
    *,
    log_fields: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    finding_total = len(findings)
    return [
        analyze_finding(
            finding,
            log_fields=log_fields,
            finding_index=index,
            finding_total=finding_total,
        )
        for index, finding in enumerate(findings, start=1)
    ]


def prepare_analysis_pipeline_context(
    scan_result: dict[str, Any],
) -> AnalysisPipelineContext:
    validate_scan_result_required_fields(scan_result)
    raw_findings = extract_findings(scan_result)
    valid_findings, invalid_findings = split_valid_invalid_findings(raw_findings)
    scan_type = scan_result.get("scanType")
    if isinstance(scan_type, str) and scan_type:
        for finding in valid_findings:
            finding["scanType"] = scan_type

    return AnalysisPipelineContext(
        scan_result=scan_result,
        raw_findings=raw_findings,
        valid_findings=valid_findings,
        invalid_findings=invalid_findings,
    )


def run_analysis_pipeline(
    scan_result_path: str = "data/scan_result.json",
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
    *,
    scan_type: str | None = None,
    log_fields: dict[str, Any] | None = None,
) -> dict[str, object]:
    load_started_ms = monotonic_ms()
    try:
        scan_result = parse_scan_result(
            load_scan_result(scan_result_path),
            scan_type_hint=scan_type,
        )
        log_analysis_step(
            "FastAPI local scan result loaded.",
            stage="LOAD_INPUT",
            started_ms=load_started_ms,
            log_fields=log_fields,
            scanResultPath=scan_result_path,
        )
    except Exception as exc:
        log_analysis_step(
            "FastAPI local scan result load failed.",
            stage="LOAD_INPUT",
            started_ms=load_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            scanResultPath=scan_result_path,
        )
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
        log_fields=log_fields,
    )


def run_analysis_pipeline_from_scan_result(
    scan_result: dict[str, Any],
    scan_result_path: str,
    output_path: str,
    *,
    scan_type: str | None = None,
    upload_to_s3: bool = False,
    log_fields: dict[str, Any] | None = None,
) -> dict[str, object]:
    parse_started_ms = monotonic_ms()
    try:
        normalized_scan_result = parse_scan_result(
            scan_result,
            scan_type_hint=scan_type,
        )
        log_analysis_step(
            "FastAPI scan result normalized.",
            stage="NORMALIZE_INPUT",
            started_ms=parse_started_ms,
            log_fields=log_fields,
            normalizedScanType=normalized_scan_result.get("scanType"),
        )
    except Exception as exc:
        log_analysis_step(
            "FastAPI scan result normalization failed.",
            stage="NORMALIZE_INPUT",
            started_ms=parse_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
        )
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            message=str(exc),
        )

    prepare_started_ms = monotonic_ms()
    try:
        context = prepare_analysis_pipeline_context(normalized_scan_result)
        log_analysis_step(
            "FastAPI scan result prepared.",
            stage="PREPARE_INPUT",
            started_ms=prepare_started_ms,
            log_fields=log_fields,
            findingCount=len(context.raw_findings),
            validFindingCount=len(context.valid_findings),
            invalidFindingCount=len(context.invalid_findings),
        )
    except Exception as exc:
        log_analysis_step(
            "FastAPI scan result preparation failed.",
            stage="PREPARE_INPUT",
            started_ms=prepare_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
        )
        return build_failed_analysis_result(
            stage="input",
            scan_result_path=scan_result_path,
            analysis_result_path=output_path,
            message=str(exc),
        )

    analysis_started_ms = monotonic_ms()
    try:
        structured_results = analyze_findings(
            context.valid_findings,
            log_fields=log_fields,
        )
        log_analysis_step(
            "FastAPI findings analysis completed.",
            stage="ANALYZE_FINDINGS",
            started_ms=analysis_started_ms,
            log_fields=log_fields,
            resultCount=len(structured_results),
            validFindingCount=len(context.valid_findings),
        )
    except FindingAnalysisError as exc:
        log_analysis_step(
            "FastAPI findings analysis failed.",
            stage=exc.stage.upper(),
            started_ms=analysis_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            findingId=exc.finding_id,
            errorCode=exc.error_code,
            validFindingCount=len(context.valid_findings),
        )
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
        log_analysis_step(
            "FastAPI findings analysis failed.",
            stage="ANALYZE_FINDINGS",
            started_ms=analysis_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            validFindingCount=len(context.valid_findings),
        )
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

    refs_started_ms = monotonic_ms()
    try:
        refs_by_id = fetch_findings_references(context.valid_findings)
        for result in structured_results:
            fid = result.get("findingId", "")
            result["references"] = refs_by_id.get(fid, [])
        log_analysis_step(
            "HasData references fetched.",
            stage="FETCH_REFERENCES",
            started_ms=refs_started_ms,
            log_fields=log_fields,
            findingCount=len(context.valid_findings),
        )
    except Exception:
        log_analysis_step(
            "HasData references fetch failed, continuing without references.",
            stage="FETCH_REFERENCES",
            started_ms=refs_started_ms,
            level=logging.WARNING,
            log_fields=log_fields,
        )
        for result in structured_results:
            result.setdefault("references", [])

    save_started_ms = monotonic_ms()
    try:
        analysis_result = build_analysis_result_from_results(
            scan_result=context.scan_result,
            structured_results=structured_results,
        )
        normalize_analysis_result_patches(
            findings=context.valid_findings,
            scan_result=context.scan_result,
            analysis_result=analysis_result,
        )
        validate_finding_id_mapping(context.valid_findings, analysis_result)
        if upload_to_s3:
            saved_path = upload_analysis_result_json_data(analysis_result, output_path)
        else:
            saved_path = save_analysis_result(analysis_result, output_path)
        log_analysis_step(
            "FastAPI analysis result saved.",
            stage="SAVE_RESULT",
            started_ms=save_started_ms,
            log_fields=log_fields,
            analysisResultPath=str(saved_path),
            resultCount=analysis_result["resultCount"],
            uploadToS3=upload_to_s3,
        )
    except S3UploadError as exc:
        log_analysis_step(
            "FastAPI analysis result save failed.",
            stage="SAVE_RESULT",
            started_ms=save_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            analysisResultPath=output_path,
            resultCount=len(structured_results),
            uploadToS3=upload_to_s3,
            errorCode="S3_UPLOAD_FAILED",
        )
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
        log_analysis_step(
            "FastAPI analysis result save failed.",
            stage="SAVE_RESULT",
            started_ms=save_started_ms,
            level=logging.ERROR,
            log_fields=log_fields,
            analysisResultPath=output_path,
            resultCount=len(structured_results),
            uploadToS3=upload_to_s3,
        )
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
