from collections import OrderedDict
from datetime import datetime, timezone
from enum import Enum
import logging
import threading

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

DEFAULT_RECENTLY_COMPLETED_CAPACITY = 1024


class TaskIdempotencyRegistry:
    """Per-process dedupe for SCAN_REQUEST taskIds.

    RabbitMQ prefetch + asyncio.to_thread fan-out can dispatch the same
    taskId to multiple worker threads. This registry serializes the entry
    check with a lock so only one thread proceeds; subsequent duplicates
    (in-flight or recently completed) return False and are ack'd by the
    consumer without re-running the analysis pipeline.
    """

    def __init__(self, max_completed: int = DEFAULT_RECENTLY_COMPLETED_CAPACITY):
        self._lock = threading.Lock()
        self._in_progress: set[int] = set()
        self._completed: OrderedDict[int, None] = OrderedDict()
        self._max_completed = max_completed

    def claim(self, task_id: int) -> bool:
        with self._lock:
            if task_id in self._completed or task_id in self._in_progress:
                return False
            self._in_progress.add(task_id)
            return True

    def release(self, task_id: int, *, completed: bool) -> None:
        with self._lock:
            self._in_progress.discard(task_id)
            if not completed:
                return
            if task_id in self._completed:
                self._completed.move_to_end(task_id)
            else:
                self._completed[task_id] = None
            while len(self._completed) > self._max_completed:
                self._completed.popitem(last=False)


class ProcessOutcome(Enum):
    PROCESSED = "processed"
    SKIPPED_DUPLICATE = "skipped_duplicate"


class RedeliveryTracker:
    """Per-process redelivery counter keyed by taskId.

    Each broker delivery increments. Cleared on successful processing.
    When count exceeds cap, consumer should nack(requeue=False) so the
    broker can dead-letter the message instead of looping forever.
    """

    def __init__(self, cap: int = 5):
        self._lock = threading.Lock()
        self._counts: dict[int, int] = {}
        self.cap = cap

    def record(self, task_id: int) -> int:
        with self._lock:
            self._counts[task_id] = self._counts.get(task_id, 0) + 1
            return self._counts[task_id]

    def clear(self, task_id: int) -> None:
        with self._lock:
            self._counts.pop(task_id, None)

    def current(self, task_id: int) -> int:
        with self._lock:
            return self._counts.get(task_id, 0)


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
        idempotency_registry: TaskIdempotencyRegistry | None = None,
        redelivery_tracker: RedeliveryTracker | None = None,
    ):
        self.spring_client = spring_client
        self.fastapi_client = fastapi_client
        self.settings = settings
        self.idempotency_registry = (
            idempotency_registry or TaskIdempotencyRegistry()
        )
        self.redelivery_tracker = (
            redelivery_tracker or RedeliveryTracker(cap=settings.redelivery_cap)
        )

    def process(self, message: ScanRequestMessage) -> ProcessOutcome:
        if not self.idempotency_registry.claim(message.task_id):
            log_with_fields(
                logger,
                logging.INFO,
                "Skipping duplicate scan task delivery.",
                scanId=message.scan_id,
                taskId=message.task_id,
                stage="MESSAGE_CONSUMED",
                status="SKIPPED_DUPLICATE",
            )
            return ProcessOutcome.SKIPPED_DUPLICATE

        completed = False
        try:
            self._process_inner(message)
            completed = True
            self.redelivery_tracker.clear(message.task_id)
            return ProcessOutcome.PROCESSED
        finally:
            self.idempotency_registry.release(
                message.task_id,
                completed=completed,
            )

    def _process_inner(self, message: ScanRequestMessage) -> None:
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
            scanType=message.scan_type,
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
                    scanType=message.scan_type,
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
            self._log_failed(
                message,
                UNKNOWN_ERROR_CODE,
                elapsed_ms(started_ms),
                failure_stage="analysis",
            )
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
        self._log_failed(
            message,
            error_code,
            elapsed_ms(started_ms),
            failure_stage=response.stage,
        )

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
            scanType=message.scan_type,
            stage="TASK_COMPLETED",
            status="DONE",
            durationMs=duration_ms,
        )

    @staticmethod
    def _log_failed(
        message: ScanRequestMessage,
        error_code: str,
        duration_ms: int,
        failure_stage: str | None = None,
    ) -> None:
        log_with_fields(
            logger,
            logging.ERROR,
            "Worker analysis failed.",
            scanId=message.scan_id,
            taskId=message.task_id,
            agentId=message.agent_id,
            projectId=message.project_id,
            scanType=message.scan_type,
            stage="TASK_FAILED",
            status=SPRING_ANALYSIS_FAILED_STATUS,
            errorCode=error_code,
            failureStage=failure_stage,
            durationMs=duration_ms,
        )
