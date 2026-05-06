package com.ssafer.scan.application.service;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
// 워커 완료 콜백을 받아 task와 scan 상태를 적재 단계에 맞게 전이한다.
public class WorkerAnalysisResultCallbackService {

  private static final String INGESTING_PROGRESS_STEP = "INGESTING_ANALYSIS_RESULT";
  private static final String FAILED_PROGRESS_STEP = "ANALYSIS_FAILED";

  private final ScanRepository scanRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final ApplicationEventPublisher applicationEventPublisher;

  @Transactional
  public Scan report(Long scanId, WorkerAnalysisResultCallbackRequest request) {
    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Scan not found: " + scanId));
    AgentTask agentTask = agentTaskRepository.findByIdAndScanId(request.taskId(), scanId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Agent task not found: " + request.taskId()));

    validateReportable(scan, agentTask);

    ScanStatus requestedStatus = resolveStatus(request);
    validateRequestedStatus(requestedStatus, request);

    LocalDateTime now = LocalDateTime.now();
    LocalDateTime lastUpdatedAt = resolveLastUpdatedAt(request, now);
    LocalDateTime completedAt = resolveCompletedAt(scan, request, requestedStatus, lastUpdatedAt);
    LocalDateTime startedAt = resolveStartedAt(scan, request, completedAt, lastUpdatedAt);

    validateResolvedTimeRange(startedAt, completedAt);

    if (requestedStatus == ScanStatus.FAILED) {
      markTaskFailed(agentTask, lastUpdatedAt, request.failureReason());
      scan.markAnalysisFailed(
          resolveFailureProgressStep(request.progressStep()),
          normalizeBlank(request.failureReason()),
          startedAt,
          completedAt,
          lastUpdatedAt
      );
      return scan;
    }

    // 성공 콜백은 바로 적재를 끝내지 않고, 커밋 후 비동기 적재 이벤트만 발행한다.
    if (agentTask.getTaskStatus() == AgentTaskStatus.SENT) {
      agentTask.markAcked(toInstant(lastUpdatedAt));
    }
    scan.markAnalysisQueuedForIngestion(
        resolveIngestingProgressStep(request.progressStep()),
        request.analysisResultPath().trim(),
        startedAt,
        lastUpdatedAt
    );
    applicationEventPublisher.publishEvent(
        new WorkerAnalysisResultIngestionRequestedEvent(scanId, agentTask.getId(), startedAt, completedAt)
    );
    return scan;
  }

  private void validateReportable(Scan scan, AgentTask agentTask) {
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
    if (agentTask.getTaskType() != AgentTaskType.SCAN_REQUEST) {
      throw new ResponseStatusException(BAD_REQUEST, "Analysis result callback requires SCAN_REQUEST task");
    }
    if (agentTask.getTaskStatus().isTerminal()) {
      throw new ResponseStatusException(
          CONFLICT,
          "Analysis result callback is not allowed for current task status: " + agentTask.getTaskStatus()
      );
    }
    if (agentTask.getTaskStatus() == AgentTaskStatus.PENDING) {
      throw new ResponseStatusException(CONFLICT, "Analysis result callback requires SENT or RUNNING task status");
    }
  }

  private ScanStatus resolveStatus(WorkerAnalysisResultCallbackRequest request) {
    return request.status() != null ? request.status() : ScanStatus.DONE;
  }

  private void validateRequestedStatus(ScanStatus status, WorkerAnalysisResultCallbackRequest request) {
    if (status != ScanStatus.DONE && status != ScanStatus.FAILED) {
      throw new ResponseStatusException(BAD_REQUEST, "Analysis result callback only supports DONE or FAILED status");
    }

    if (status == ScanStatus.DONE && !hasText(request.analysisResultPath())) {
      throw new ResponseStatusException(BAD_REQUEST, "DONE status requires analysisResultPath");
    }

    if (status == ScanStatus.FAILED && !hasText(request.failureReason())) {
      throw new ResponseStatusException(BAD_REQUEST, "FAILED status requires failureReason");
    }
  }

  private void markTaskFailed(AgentTask agentTask, LocalDateTime lastUpdatedAt, String failureReason) {
    if (agentTask.getTaskStatus() == AgentTaskStatus.SENT) {
      agentTask.markAcked(toInstant(lastUpdatedAt));
    }
    if (agentTask.getTaskStatus() == AgentTaskStatus.ACKED) {
      agentTask.markRunning(toInstant(lastUpdatedAt));
    }
    agentTask.markFailed(toInstant(lastUpdatedAt), normalizeBlank(failureReason));
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

  private String resolveFailureProgressStep(String progressStep) {
    return hasText(progressStep) ? progressStep : FAILED_PROGRESS_STEP;
  }

  private String resolveIngestingProgressStep(String progressStep) {
    return hasText(progressStep) ? progressStep : INGESTING_PROGRESS_STEP;
  }

  private Instant toInstant(LocalDateTime value) {
    return value.atZone(java.time.ZoneId.systemDefault()).toInstant();
  }

  private String normalizeBlank(String value) {
    return hasText(value) ? value : null;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
