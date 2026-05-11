from datetime import datetime, timezone
import logging

from app.core.analysis_errors import (
    ANALYSIS_FAILED_PROGRESS_STEP,
    SPRING_ANALYSIS_FAILED_STATUS,
    UNKNOWN_ERROR_CODE,
    format_failure_reason,
)
from app.core.logging_utils import elapsed_ms, log_with_fields, monotonic_ms
from app.worker.config import WorkerSettings
from app.worker.fastapi_client import FastApiClient
from app.worker.schemas import (
    AnalysisResultCallbackRequest,
    FastApiAnalyzeRequest,
    FastApiAnalyzeResponse,
    ScanRequestMessage,
)
from app.worker.spring_client import SpringClient


logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

ANALYSIS_STARTED_PROGRESS_STEP = "analysis_started"


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
            "APP_ANALYSIS_RESULT_S3_BUCKET must be set to build analysisResultPath."
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
        started_ms = monotonic_ms()
        analysis_result_path = build_analysis_result_path(message, self.settings)
        log_with_fields(
            logger,
            logging.INFO,
            "Worker analysis started.",
            scanId=message.scan_id,
            taskId=message.task_id,
            agentId=message.agent_id,
            projectId=message.project_id,
            stage="ANALYZE_REQUEST",
            status="RUNNING",
        )
        self._send_running_callback(
            message=message,
            started_at=started_at,
        )

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
                stage="analysis",
                failure_reason=format_failure_reason(
                    error_code=UNKNOWN_ERROR_CODE,
                    message=str(exc),
                    stage="analysis",
                    prefix="FastAPI analysis failed",
                ),
            )
            self._log_failed(message, UNKNOWN_ERROR_CODE, elapsed_ms(started_ms))
            return

        if response.succeeded:
            self._send_done_callback(
                message=message,
                started_at=started_at,
                analysis_result_path=response.analysis_result_path
                or analysis_result_path,
            )
            self._log_completed(message, elapsed_ms(started_ms))
            return

        error_code = response.error_code or UNKNOWN_ERROR_CODE
        self._send_failed_callback(
            message=message,
            started_at=started_at,
            error_code=error_code,
            stage=response.stage,
            failure_reason=self._build_failure_reason(response),
        )
        self._log_failed(message, error_code, elapsed_ms(started_ms))

    def _send_running_callback(
        self,
        *,
        message: ScanRequestMessage,
        started_at: str,
    ) -> None:
        self.spring_client.send_analysis_result_callback(
            message.scan_id,
            AnalysisResultCallbackRequest(
                taskId=message.task_id,
                status="RUNNING",
                progressStep=ANALYSIS_STARTED_PROGRESS_STEP,
                startedAt=started_at,
                lastUpdatedAt=started_at,
            ),
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
        stage: str | None,
        failure_reason: str,
    ) -> None:
        completed_at = utc_now_iso()
        self.spring_client.send_analysis_result_callback(
            message.scan_id,
            AnalysisResultCallbackRequest(
                taskId=message.task_id,
                status=SPRING_ANALYSIS_FAILED_STATUS,
                progressStep=ANALYSIS_FAILED_PROGRESS_STEP,
                stage=stage,
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

    @staticmethod
    def _log_completed(message: ScanRequestMessage, duration_ms: int) -> None:
        log_with_fields(
            logger,
            logging.INFO,
            "Worker analysis completed.",
            scanId=message.scan_id,
            taskId=message.task_id,
            agentId=message.agent_id,
            projectId=message.project_id,
            stage="TASK_COMPLETED",
            status="DONE",
            durationMs=duration_ms,
        )

    @staticmethod
    def _log_failed(
        message: ScanRequestMessage,
        error_code: str,
        duration_ms: int,
    ) -> None:
        log_with_fields(
            logger,
            logging.ERROR,
            "Worker analysis failed.",
            scanId=message.scan_id,
            taskId=message.task_id,
            agentId=message.agent_id,
            projectId=message.project_id,
            stage="TASK_FAILED",
            status=SPRING_ANALYSIS_FAILED_STATUS,
            errorCode=error_code,
            durationMs=duration_ms,
        )
