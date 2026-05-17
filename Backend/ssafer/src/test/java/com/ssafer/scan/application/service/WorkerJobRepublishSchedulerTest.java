package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import com.ssafer.worker.domain.repository.WorkerJobRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class WorkerJobRepublishSchedulerTest {

  @Mock
  private WorkerJobRepository workerJobRepository;
  @Mock
  private ScanRepository scanRepository;
  @Mock
  private AgentTaskPublisher agentTaskPublisher;
  @Mock
  private ApplicationEventPublisher applicationEventPublisher;
  @Mock
  private PlatformTransactionManager transactionManager;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private WorkerJobRepublishScheduler scheduler;

  @BeforeEach
  void setUp() {
    scheduler = new WorkerJobRepublishScheduler(
        workerJobRepository,
        scanRepository,
        agentTaskPublisher,
        applicationEventPublisher,
        objectMapper,
        transactionManager,
        3,
        20,
        120
    );
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
  }

  @Test
  void republishStaleJobsRepublishesPublishedJob() {
    Scan scan = queuedScan();
    WorkerJob job = publishedJob(scan, 2L, 1);
    when(workerJobRepository.findByJobStatusInOrderByQueuedAtAsc(List.of(WorkerJobStatus.PUBLISHED)))
        .thenReturn(List.of(job));
    when(workerJobRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(job));
    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));

    scheduler.republishStaleJobs();

    verify(agentTaskPublisher).publishScanRequest(any(ScanRequestTaskMessage.class));
    assertThat(job.getPublishAttemptCount()).isEqualTo(2);
    assertThat(job.getJobStatus()).isEqualTo(WorkerJobStatus.PUBLISHED);
  }

  @Test
  void republishStaleJobsMarksFailedWhenAttemptsExhausted() {
    Scan scan = queuedScan();
    WorkerJob job = publishedJob(scan, 2L, 3);
    when(workerJobRepository.findByJobStatusInOrderByQueuedAtAsc(List.of(WorkerJobStatus.PUBLISHED)))
        .thenReturn(List.of(job));
    when(workerJobRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(job));
    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(scan));

    scheduler.republishStaleJobs();

    verify(agentTaskPublisher, never()).publishScanRequest(any(ScanRequestTaskMessage.class));
    assertThat(job.getJobStatus()).isEqualTo(WorkerJobStatus.FAILED);
    assertThat(job.getFailureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name());
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(scan.getFailureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name());
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  private Scan queuedScan() {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.QUEUED)
        .requestedAt(LocalDateTime.now().minusMinutes(10))
        .startedAt(LocalDateTime.now().minusMinutes(9))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(9))
        .build();
  }

  private WorkerJob publishedJob(Scan scan, Long jobId, int attempts) {
    Project project = new Project(20L, null, "project-a", null, ScanMode.AGENT, false);
    WorkerJob job = new WorkerJob(project, scan, WorkerJobType.UPLOAD_ANALYSIS_REQUEST, WorkerJobStatus.PENDING, null);
    ReflectionTestUtils.setField(job, "id", jobId);
    ReflectionTestUtils.setField(job, "queuedAt", Instant.now().minusSeconds(600));
    job.updatePayloadJson("{\"messageType\":\"SCAN_REQUEST\",\"messageVersion\":2,\"taskType\":\"SCAN_REQUEST\",\"taskId\":2,\"agentId\":30,\"projectId\":10,\"scanId\":1,\"scanType\":\"PROJECT_FILE\",\"rawResultPath\":\"s3://ssafer/raw/1/scan_result.json\",\"resultCount\":1,\"tool\":\"ssafer\",\"toolVersion\":\"0.1.0\",\"payloadHash\":\"sha256:abc\",\"queuedAt\":\"2026-05-17T00:00:00Z\"}");
    for (int i = 0; i < attempts; i++) {
      job.markPublished(Instant.now().minusSeconds(300 - i));
    }
    return job;
  }
}
