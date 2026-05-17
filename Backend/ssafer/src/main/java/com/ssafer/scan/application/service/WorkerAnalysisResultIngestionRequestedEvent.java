package com.ssafer.scan.application.service;

import java.time.LocalDateTime;

// 워커 완료 콜백 이후 커밋이 끝나면 비동기 적재를 시작하기 위한 내부 이벤트다.
// taskId is kept for naming continuity, but it now carries worker_job.id.
public record WorkerAnalysisResultIngestionRequestedEvent(
    Long scanId,
    Long taskId,
    LocalDateTime startedAt,
    LocalDateTime completedAt
) {
}
