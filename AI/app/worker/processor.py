import time
from datetime import datetime, timezone

from app.worker.config import WorkerSettings
from app.worker.fastapi_client import FastApiClient
from app.worker.schemas import (
    AgentTaskResultRequest,
    AgentTaskStatusUpdateRequest,
    FastApiAnalyzeRequest,
    ScanRequestMessage,
)
from app.worker.spring_client import SpringClient


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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
        started = time.monotonic()
        analysis_result_path = build_analysis_result_path(message, self.settings)

        self.spring_client.update_task_status(
            message.task_id,
            AgentTaskStatusUpdateRequest(
                agentId=message.agent_id,
                scanId=message.scan_id,
                status="ACKED",
                occurredAt=utc_now_iso(),
            ),
        )
        self.spring_client.update_task_status(
            message.task_id,
            AgentTaskStatusUpdateRequest(
                agentId=message.agent_id,
                scanId=message.scan_id,
                status="RUNNING",
                occurredAt=utc_now_iso(),
            ),
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
            self._send_failed_result(
                message=message,
                duration_ms=self._duration_ms(started),
                error_code="FASTAPI_ANALYZE_FAILED",
                error_message=str(exc),
                stage="ANALYZE_REQUEST",
                retryable=True,
            )
            return

        duration_ms = self._duration_ms(started)
        if response.succeeded:
            self.spring_client.send_task_result(
                message.task_id,
                AgentTaskResultRequest(
                    agentId=message.agent_id,
                    scanId=message.scan_id,
                    status="SUCCEEDED",
                    analysisResultPath=response.analysis_result_path,
                    findingCount=response.finding_count,
                    validFindingCount=response.valid_finding_count,
                    invalidFindingCount=response.invalid_finding_count,
                    resultCount=response.result_count,
                    durationMs=duration_ms,
                ),
            )
            return

        self.spring_client.send_task_result(
            message.task_id,
            AgentTaskResultRequest(
                agentId=message.agent_id,
                scanId=message.scan_id,
                status="FAILED",
                analysisResultPath=response.analysis_result_path,
                findingCount=response.finding_count,
                validFindingCount=response.valid_finding_count,
                invalidFindingCount=response.invalid_finding_count,
                resultCount=response.result_count,
                errorCode=response.error_code or "ANALYSIS_FAILED",
                message=response.message,
                stage=response.stage,
                retryable=False,
                durationMs=duration_ms,
            ),
        )

    def _send_failed_result(
        self,
        *,
        message: ScanRequestMessage,
        duration_ms: int,
        error_code: str,
        error_message: str,
        stage: str,
        retryable: bool,
    ) -> None:
        self.spring_client.send_task_result(
            message.task_id,
            AgentTaskResultRequest(
                agentId=message.agent_id,
                scanId=message.scan_id,
                status="FAILED",
                errorCode=error_code,
                message=error_message,
                stage=stage,
                retryable=retryable,
                durationMs=duration_ms,
            ),
        )

    @staticmethod
    def _duration_ms(started: float) -> int:
        return int((time.monotonic() - started) * 1000)
