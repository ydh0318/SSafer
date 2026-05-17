package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import com.ssafer.worker.domain.repository.WorkerJobRepository;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultCallbackServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private WorkerJobRepository workerJobRepository;

  @Mock
  private ApplicationEventPublisher applicationEventPublisher;

  @InjectMocks
  private WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @Test
  void reportDoneStatusPublishesAsyncIngestionEvent() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime completedAt = requestedAt.plusMinutes(5);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(5);
    Scan scan = queuedScan(requestedAt);
    WorkerJob workerJob = publishedJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        startedAt,
        completedAt,
        lastUpdatedAt
    );

    Scan reported = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(reported).isSameAs(scan);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.RUNNING);
    assertThat(scan.getAnalysisResultPath()).isEqualTo("s3://ssafer/result/1/analysis_result.json");
    assertThat(scan.getProgressStep()).isEqualTo("INGESTING_ANALYSIS_RESULT");
    assertThat(workerJob.getJobStatus()).isEqualTo(WorkerJobStatus.RUNNING);

    ArgumentCaptor<WorkerAnalysisResultIngestionRequestedEvent> eventCaptor =
        ArgumentCaptor.forClass(WorkerAnalysisResultIngestionRequestedEvent.class);
    verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
    assertThat(eventCaptor.getValue()).isEqualTo(
        new WorkerAnalysisResultIngestionRequestedEvent(1L, workerJob.getId(), startedAt, completedAt)
    );
  }

  @Test
  void reportRunningStatusMarksTaskRunningAndScanRunning() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(2);
    Scan scan = queuedScan(requestedAt);
    WorkerJob workerJob = publishedJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.RUNNING,
        null,
        null,
        null,
        startedAt,
        null,
        lastUpdatedAt
    );

    Scan reported = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(reported).isSameAs(scan);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.RUNNING);
    assertThat(scan.getProgressStep()).isEqualTo("ANALYZING");
    assertThat(workerJob.getJobStatus()).isEqualTo(WorkerJobStatus.RUNNING);
    verify(applicationEventPublisher, org.mockito.Mockito.never()).publishEvent(any());
  }

  @Test
  void reportFailedStatusMarksTaskAndScanFailed() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(2);
    Scan scan = runningScan(requestedAt, startedAt, lastUpdatedAt);
    WorkerJob workerJob = runningJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.FAILED,
        null,
        "worker analysis failed",
        null,
        startedAt,
        lastUpdatedAt,
        lastUpdatedAt
    );

    Scan reported = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(reported.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(reported.getFailureReason()).isEqualTo("worker analysis failed");
    assertThat(workerJob.getJobStatus()).isEqualTo(WorkerJobStatus.FAILED);
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  @Test
  void reportDoneStatusWithoutAnalysisResultPathThrowsBadRequest() {
    Scan scan = queuedScan(LocalDateTime.of(2026, 4, 24, 15, 0));
    WorkerJob workerJob = publishedJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        null,
        null,
        null,
        null
    );

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }

  @Test
  void reportWithoutStatusThrowsBadRequest() {
    Scan scan = queuedScan(LocalDateTime.of(2026, 4, 24, 15, 0));
    WorkerJob workerJob = publishedJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        null,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null
    );

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }

  @Test
  void reportWhenScanMissingThrowsNotFound() {
    when(scanRepository.findByIdForUpdate(999L)).thenReturn(Optional.empty());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        999L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/999/analysis_result.json",
        null,
        null,
        null
    );

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(999L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void reportWhenTaskMissingThrowsNotFound() {
    Scan scan = queuedScan(LocalDateTime.of(2026, 4, 24, 15, 0));

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(100L, 1L)).thenReturn(Optional.empty());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null
    );

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void reportWhenScanIsTerminalThrowsConflict() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    Scan scan = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(requestedAt)
        .lastUpdatedAt(requestedAt.plusMinutes(1))
        .build();
    WorkerJob workerJob = publishedJob(scan);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(anyLong(), anyLong())).thenReturn(Optional.of(workerJob));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null
    );

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }

  private Scan queuedScan(LocalDateTime requestedAt) {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(requestedAt)
        .startedAt(requestedAt.plusMinutes(1))
        .lastUpdatedAt(requestedAt.plusMinutes(2))
        .build();
  }

  private Scan runningScan(LocalDateTime requestedAt, LocalDateTime startedAt, LocalDateTime lastUpdatedAt) {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .lastUpdatedAt(lastUpdatedAt)
        .analysisResultPath("s3://ssafer/result/1/analysis_result.json")
        .build();
  }

  private WorkerJob publishedJob(Scan scan) {
    WorkerJob job = baseJob(scan);
    job.markPublished(java.time.Instant.now());
    return job;
  }

  private WorkerJob runningJob(Scan scan) {
    WorkerJob job = publishedJob(scan);
    job.markRunning(java.time.Instant.now());
    return job;
  }

  private WorkerJob baseJob(Scan scan) {
    WorkerJob job = new WorkerJob(project(), scan, WorkerJobType.UPLOAD_ANALYSIS_REQUEST, WorkerJobStatus.PENDING, null);
    org.springframework.test.util.ReflectionTestUtils.setField(job, "id", 100L);
    return job;
  }

  private Project project() {
    return new Project(20L, null, "test-project", null, ScanMode.AGENT, false);
  }
}
