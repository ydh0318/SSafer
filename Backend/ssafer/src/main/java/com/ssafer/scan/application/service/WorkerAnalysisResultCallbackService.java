package com.ssafer.scan.application.service;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import com.ssafer.worker.domain.repository.WorkerJobRepository;

@Service
@RequiredArgsConstructor
// 워커 콜백을 받아 task와 scan 상태를 현재 단계에 맞게 올린다.
public class WorkerAnalysisResultCallbackService {

  private static final String RUNNING_PROGRESS_STEP = "ANALYZING";
  private static final String INGESTING_PROGRESS_STEP = "INGESTING_ANALYSIS_RESULT";
  private static final String FAILED_PROGRESS_STEP = "ANALYSIS_FAILED";

  private final ScanRepository scanRepository;
  private final WorkerJobRepository workerJobRepository;
  private final ApplicationEventPublisher applicationEventPublisher;

  @Transactional
  public Scan report(Long scanId, WorkerAnalysisResultCallbackRequest request) {
    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Scan not found: " + scanId));
    // Worker callback의 taskId는 이제 agent_task.id가 아니라 worker_job.id를 의미한다.
    WorkerJob workerJob = workerJobRepository.findByIdAndScanIdForUpdate(request.taskId(), scanId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Worker job not found: " + request.taskId()));

    validateReportable(scan, workerJob);

    ScanStatus requestedStatus = resolveStatus(request);
    validateRequestedStatus(requestedStatus, request);

    LocalDateTime now = LocalDateTime.now();
    LocalDateTime lastUpdatedAt = resolveLastUpdatedAt(request, now);
    LocalDateTime completedAt = resolveCompletedAt(scan, request, requestedStatus, lastUpdatedAt);
    LocalDateTime startedAt = resolveStartedAt(scan, request, completedAt, lastUpdatedAt);

    validateResolvedTimeRange(startedAt, completedAt);

    if (requestedStatus == ScanStatus.RUNNING) {
      markJobRunning(workerJob, lastUpdatedAt);
      scan.markAnalysisRunning(resolveRunningProgressStep(request.progressStep()), startedAt, lastUpdatedAt);
      return scan;
    }

    if (requestedStatus == ScanStatus.FAILED) {
      markJobRunning(workerJob, lastUpdatedAt);
      markJobFailed(workerJob, lastUpdatedAt, request.failureReason());
      scan.markAnalysisFailed(
          resolveFailureProgressStep(request.progressStep()),
          normalizeBlank(request.failureReason()),
          startedAt,
          completedAt,
          lastUpdatedAt
      );
      // 실패 알림은 커밋 이후 발행해서 프론트 후속 조회와 상태 커밋 시점을 맞춘다.
      applicationEventPublisher.publishEvent(new ScanStatusSsePublishRequestedEvent(scan.getId(), ScanStatus.FAILED));
      return scan;
    }

    // 성공 콜백은 결과 파일 경로만 기록하고, 실제 적재는 비동기 이벤트로 넘긴다.
    markJobRunning(workerJob, lastUpdatedAt);
    scan.markAnalysisQueuedForIngestion(
        resolveIngestingProgressStep(request.progressStep()),
        request.analysisResultPath().trim(),
        startedAt,
        lastUpdatedAt
    );
    applicationEventPublisher.publishEvent(
        new WorkerAnalysisResultIngestionRequestedEvent(scanId, workerJob.getId(), startedAt, completedAt)
    );
    return scan;
  }

  private void validateReportable(Scan scan, WorkerJob workerJob) {
    if (scan.getStatus().isTerminal()) {
      throw new ResponseStatusException(
          CONFLICT,
          "Analysis result callback is not allowed for current scan status: " + scan.getStatus()
      );
    }
    if (scan.getStatus() != ScanStatus.QUEUED && scan.getStatus() != ScanStatus.RUNNING) {
      throw new ResponseStatusException(
          CONFLICT,
          "Analysis result callback requires QUEUED or RUNNING scan status"
      );
    }
    if (workerJob.getJobType() != WorkerJobType.UPLOAD_ANALYSIS_REQUEST) {
      throw new ResponseStatusException(BAD_REQUEST, "Analysis result callback requires upload analysis worker job");
    }
    if (workerJob.getJobStatus().isTerminal()) {
      throw new ResponseStatusException(
          CONFLICT,
          "Analysis result callback is not allowed for current worker job status: " + workerJob.getJobStatus()
      );
    }
    if (workerJob.getJobStatus() == WorkerJobStatus.PENDING) {
      throw new ResponseStatusException(CONFLICT, "Analysis result callback requires PUBLISHED or RUNNING worker job status");
    }
  }

  private ScanStatus resolveStatus(WorkerAnalysisResultCallbackRequest request) {
    if (request.status() == null) {
      throw new ResponseStatusException(BAD_REQUEST, "status is required");
    }
    return request.status();
  }

  private void validateRequestedStatus(ScanStatus status, WorkerAnalysisResultCallbackRequest request) {
    if (status != ScanStatus.RUNNING && status != ScanStatus.DONE && status != ScanStatus.FAILED) {
      throw new ResponseStatusException(BAD_REQUEST, "Analysis result callback only supports RUNNING, DONE or FAILED status");
    }

    if (status == ScanStatus.DONE && !hasText(request.analysisResultPath())) {
      throw new ResponseStatusException(BAD_REQUEST, "DONE status requires analysisResultPath");
    }

    if (status == ScanStatus.FAILED && !hasText(request.failureReason())) {
      throw new ResponseStatusException(BAD_REQUEST, "FAILED status requires failureReason");
    }
  }

  private void markJobRunning(WorkerJob workerJob, LocalDateTime lastUpdatedAt) {
    if (workerJob.getJobStatus() == WorkerJobStatus.PUBLISHED) {
      workerJob.markRunning(toInstant(lastUpdatedAt));
    }
  }

  private void markJobFailed(WorkerJob workerJob, LocalDateTime lastUpdatedAt, String failureReason) {
    workerJob.markFailed(toInstant(lastUpdatedAt), normalizeBlank(failureReason));
  }

  private LocalDateTime resolveLastUpdatedAt(WorkerAnalysisResultCallbackRequest request, LocalDateTime now) {
    if (request.lastUpdatedAt() != null) {
      return request.lastUpdatedAt();
    }
    if (request.completedAt() != null) {
      return request.completedAt();
    }
    return now;
  }

  private LocalDateTime resolveCompletedAt(
      Scan scan,
      WorkerAnalysisResultCallbackRequest request,
      ScanStatus status,
      LocalDateTime lastUpdatedAt
  ) {
    if (request.completedAt() != null) {
      return request.completedAt();
    }
    if (status == ScanStatus.FAILED) {
      return lastUpdatedAt;
    }
    return scan.getCompletedAt();
  }

  private LocalDateTime resolveStartedAt(
      Scan scan,
      WorkerAnalysisResultCallbackRequest request,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt
  ) {
    if (request.startedAt() != null) {
      return request.startedAt();
    }
    if (scan.getStartedAt() != null) {
      return scan.getStartedAt();
    }
    return completedAt != null ? completedAt : lastUpdatedAt;
  }

  private void validateResolvedTimeRange(LocalDateTime startedAt, LocalDateTime completedAt) {
    if (startedAt != null && completedAt != null && startedAt.isAfter(completedAt)) {
      throw new ResponseStatusException(BAD_REQUEST, "startedAt must be before or equal to completedAt");
    }
  }

  private String resolveRunningProgressStep(String progressStep) {
    return hasText(progressStep) ? progressStep : RUNNING_PROGRESS_STEP;
  }

  private String resolveFailureProgressStep(String progressStep) {
    return hasText(progressStep) ? progressStep : FAILED_PROGRESS_STEP;
  }

  private String resolveIngestingProgressStep(String progressStep) {
    return hasText(progressStep) ? progressStep : INGESTING_PROGRESS_STEP;
  }

  private Instant toInstant(LocalDateTime value) {
    return value.atZone(ZoneId.systemDefault()).toInstant();
  }

  private String normalizeBlank(String value) {
    return hasText(value) ? value : null;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
