from datetime import datetime, timezone

from app.core.analysis_errors import (
    ANALYSIS_FAILED_PROGRESS_STEP,
    SPRING_ANALYSIS_FAILED_STATUS,
    UNKNOWN_ERROR_CODE,
    format_failure_reason,
)
from app.worker.config import WorkerSettings
from app.worker.fastapi_client import FastApiClient
from app.worker.schemas import (
    AnalysisResultCallbackRequest,
    FastApiAnalyzeRequest,
    FastApiAnalyzeResponse,
    ScanRequestMessage,
)
from app.worker.spring_client import SpringClient


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def build_analysis_result_path(
    message: ScanRequestMessage,
    settings: WorkerSettings,
) -> str:
    prefix = settings.analysis_result_prefix.strip("/")
    if prefix.startswith("s3://"):
        return f"{prefix}/{message.scan_id}/analysis_result.json"

    if settings.analysis_result_bucket is None:
        raise ValueError(
            "APP_ANALYSIS_RESULT_S3_BUCKET or AWS_S3_BUCKET must be set "
            "to build analysisResultPath."
        )

    return (
        f"s3://{settings.analysis_result_bucket}/"
        f"{prefix}/{message.scan_id}/analysis_result.json"
    )


class ScanTaskProcessor:
    def __init__(
        self,
        *,
        spring_client: SpringClient,
        fastapi_client: FastApiClient,
        settings: WorkerSettings,
    ):
        self.spring_client = spring_client
        self.fastapi_client = fastapi_client
        self.settings = settings

    def process(self, message: ScanRequestMessage) -> None:
        started_at = utc_now_iso()
        analysis_result_path = build_analysis_result_path(message, self.settings)

        try:
            response = self.fastapi_client.analyze(
                FastApiAnalyzeRequest(
                    taskId=message.task_id,
                    agentId=message.agent_id,
                    projectId=message.project_id,
                    scanId=message.scan_id,
                    rawResultPath=message.raw_result_path,
                    analysisResultPath=analysis_result_path,
                )
            )
        except Exception as exc:
            self._send_failed_callback(
                message=message,
                started_at=started_at,
                error_code=UNKNOWN_ERROR_CODE,
                failure_reason=format_failure_reason(
                    error_code=UNKNOWN_ERROR_CODE,
                    message=str(exc),
                    prefix="FastAPI analysis failed",
                ),
            )
            return

        if response.succeeded:
            self._send_done_callback(
                message=message,
                started_at=started_at,
                analysis_result_path=response.analysis_result_path
                or analysis_result_path,
            )
            return

        self._send_failed_callback(
            message=message,
            started_at=started_at,
            error_code=response.error_code or UNKNOWN_ERROR_CODE,
            failure_reason=self._build_failure_reason(response),
        )

    def _send_done_callback(
        self,
        *,
        message: ScanRequestMessage,
        started_at: str,
        analysis_result_path: str,
    ) -> None:
        completed_at = utc_now_iso()
        self.spring_client.send_analysis_result_callback(
            message.scan_id,
            AnalysisResultCallbackRequest(
                taskId=message.task_id,
                status="DONE",
                progressStep="analysis_completed",
                analysisResultPath=analysis_result_path,
                startedAt=started_at,
                completedAt=completed_at,
                lastUpdatedAt=completed_at,
            ),
        )

    def _send_failed_callback(
        self,
        *,
        message: ScanRequestMessage,
        started_at: str,
        error_code: str,
        failure_reason: str,
    ) -> None:
        completed_at = utc_now_iso()
        self.spring_client.send_analysis_result_callback(
            message.scan_id,
            AnalysisResultCallbackRequest(
                taskId=message.task_id,
                status=SPRING_ANALYSIS_FAILED_STATUS,
                progressStep=ANALYSIS_FAILED_PROGRESS_STEP,
                errorCode=error_code,
                failureReason=failure_reason,
                startedAt=started_at,
                completedAt=completed_at,
                lastUpdatedAt=completed_at,
            ),
        )

    @staticmethod
    def _build_failure_reason(response: FastApiAnalyzeResponse) -> str:
        return format_failure_reason(
            error_code=response.error_code,
            message=response.message,
            stage=response.stage,
            prefix="FastAPI analysis failed",
        )
