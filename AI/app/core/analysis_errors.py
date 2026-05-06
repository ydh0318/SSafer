from dataclasses import dataclass


ANALYSIS_FAILED_STATUS = "failed"
SPRING_ANALYSIS_FAILED_STATUS = "FAILED"
ANALYSIS_FAILED_PROGRESS_STEP = "analysis_failed"

UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR"

ERROR_STATUS_BY_STAGE = {
    "input": 400,
    "explain": 502,
    "fix": 502,
    "analysis": 502,
    "output": 500,
}

ERROR_CODE_BY_STAGE = {
    "input": "ANALYSIS_INPUT_ERROR",
    "explain": "LLM_CALL_FAILED",
    "fix": "LLM_CALL_FAILED",
    "analysis": "ANALYSIS_PIPELINE_ERROR",
    "output": "ANALYSIS_OUTPUT_ERROR",
}


@dataclass(frozen=True)
class StandardAnalysisError:
    status: str
    error_code: str
    message: str
    stage: str


def normalize_error_message(message: str | None) -> str:
    normalized = (message or "").strip()
    return normalized or "Analysis failed."


def get_error_code_for_stage(stage: str | None) -> str:
    return ERROR_CODE_BY_STAGE.get(stage or "analysis", UNKNOWN_ERROR_CODE)


def get_http_status_for_stage(stage: str | None) -> int:
    return ERROR_STATUS_BY_STAGE.get(stage or "analysis", 500)


def build_standard_analysis_error(
    *,
    stage: str | None,
    message: str | None,
    error_code: str | None = None,
) -> StandardAnalysisError:
    normalized_stage = stage or "analysis"
    return StandardAnalysisError(
        status=ANALYSIS_FAILED_STATUS,
        error_code=error_code or get_error_code_for_stage(normalized_stage),
        message=normalize_error_message(message),
        stage=normalized_stage,
    )


def format_failure_reason(
    *,
    error_code: str | None,
    message: str | None,
    stage: str | None = None,
    prefix: str | None = None,
) -> str:
    details = normalize_error_message(message)
    if prefix:
        details = f"{prefix}: {details}"
    code = error_code or UNKNOWN_ERROR_CODE
    reason = f"{code}: {details}"
    if stage:
        reason = f"{reason} (stage={stage})"
    return reason
