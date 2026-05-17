package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.entity.ScanNode;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultPersistenceServiceTest {

  private static final String ANALYSIS_RESULT_JSON = """
      {
        "schemaVersion": "0.2",
        "scanId": "upload-scan-1",
        "source": "cli",
        "generatedAt": "2026-05-04T01:57:29.596745+00:00",
        "resultCount": 1,
        "results": [
          {
            "findingId": "FND-0001",
            "ruleId": "ENV_PLAIN_SECRET",
            "source": "custom-rule",
            "severity": "HIGH",
            "filePath": "Backend\\\\ssafer\\\\.env",
            "line": 1,
            "title": "Hardcoded secret",
            "maskedEvidence": "DB_PASSWORD=***MASKED***",
            "explanation": {
              "summary": "summary 1",
              "abuseScenario": "abuse scenario 1"
            },
            "fix": {
              "summary": "fix summary 1",
              "recommendedActions": ["action-1"]
            }
          }
        ],
        "patches": [
          {
            "patchId": "PATCH-0001",
            "findingId": "FND-0001",
            "targetFile": ".env",
            "operation": "replace",
            "oldText": "DB_PASSWORD=plain-text",
            "newText": "DB_PASSWORD=${DB_PASSWORD}"
          }
        ]
      }
      """;

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private WorkerJobRepository workerJobRepository;
  @Mock
  private ScanNodeRepository scanNodeRepository;
  @Mock
  private ScanFindingRepository scanFindingRepository;
  @Mock
  private AnalysisResultObjectReader analysisResultObjectReader;
  @Mock
  private ApplicationEventPublisher applicationEventPublisher;

  private WorkerAnalysisResultPersistenceService service;

  @BeforeEach
  void setUp() {
    service = new WorkerAnalysisResultPersistenceService(
        scanRepository,
        workerJobRepository,
        scanNodeRepository,
        scanFindingRepository,
        analysisResultObjectReader,
        new ObjectMapper(),
        applicationEventPublisher
    );
  }

  @Test
  void persistMarksWorkerJobSucceededAndSavesFindings() throws Exception {
    Scan scan = runningScan();
    WorkerJob workerJob = publishedWorkerJob(scan);
    ScanNode savedNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("upload-scan-1")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(workerJob.getId(), scan.getId()))
        .thenReturn(Optional.of(workerJob));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "upload-scan-1")).thenReturn(Optional.empty());
    when(scanNodeRepository.save(any(ScanNode.class))).thenReturn(savedNode);
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of());
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(1L);

    service.persist(event(workerJob));

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue()).hasSize(1);
    assertThat(findingsCaptor.getValue().getFirst().getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(findingsCaptor.getValue().getFirst().getPatchPayloadJson()).contains("PATCH-0001");
    assertThat(workerJob.getJobStatus()).isEqualTo(WorkerJobStatus.SUCCEEDED);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.DONE);
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.DONE));
  }

  @Test
  void persistSkipsWhenScanAndWorkerJobAlreadyCompleted() {
    Scan scan = completedScan();
    WorkerJob workerJob = succeededWorkerJob(scan);

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(workerJob.getId(), scan.getId()))
        .thenReturn(Optional.of(workerJob));

    service.persist(event(workerJob));

    verify(analysisResultObjectReader, never()).read(any());
    verify(scanFindingRepository, never()).saveAll(any());
  }

  @Test
  void markFailedMarksWorkerJobAndScanFailed() {
    Scan scan = runningScan();
    WorkerJob workerJob = publishedWorkerJob(scan);

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(workerJobRepository.findByIdAndScanIdForUpdate(workerJob.getId(), scan.getId()))
        .thenReturn(Optional.of(workerJob));

    service.markFailed(event(workerJob), new IllegalStateException("temporary s3 failure"));

    assertThat(workerJob.getJobStatus()).isEqualTo(WorkerJobStatus.FAILED);
    assertThat(workerJob.getFailureReason()).contains("temporary s3 failure");
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.FAILED);
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  private WorkerAnalysisResultIngestionRequestedEvent event(WorkerJob workerJob) {
    return new WorkerAnalysisResultIngestionRequestedEvent(
        1L,
        workerJob.getId(),
        LocalDateTime.of(2026, 5, 6, 10, 1),
        LocalDateTime.of(2026, 5, 6, 10, 5)
    );
  }

  private Scan runningScan() {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.RUNNING)
        .progressStep(WorkerAnalysisResultPersistenceService.INGESTING_PROGRESS_STEP)
        .analysisResultPath("s3://ssafer/result/1/analysis_result.json")
        .requestedAt(LocalDateTime.of(2026, 5, 6, 10, 0))
        .startedAt(LocalDateTime.of(2026, 5, 6, 10, 1))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 6, 10, 2))
        .build();
  }

  private Scan completedScan() {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .analysisResultPath("s3://ssafer/result/1/analysis_result.json")
        .requestedAt(LocalDateTime.of(2026, 5, 6, 10, 0))
        .startedAt(LocalDateTime.of(2026, 5, 6, 10, 1))
        .completedAt(LocalDateTime.of(2026, 5, 6, 10, 5))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 6, 10, 5))
        .build();
  }

  private WorkerJob publishedWorkerJob(Scan scan) {
    WorkerJob workerJob = baseWorkerJob(scan);
    workerJob.markPublished(Instant.now());
    return workerJob;
  }

  private WorkerJob succeededWorkerJob(Scan scan) {
    WorkerJob workerJob = publishedWorkerJob(scan);
    workerJob.markRunning(Instant.now());
    workerJob.markSucceeded(Instant.now());
    return workerJob;
  }

  private WorkerJob baseWorkerJob(Scan scan) {
    Project project = new Project(20L, null, "test-project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", scan.getProjectId());
    WorkerJob workerJob = new WorkerJob(
        project,
        scan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PENDING,
        null
    );
    ReflectionTestUtils.setField(workerJob, "id", 100L);
    return workerJob;
  }
}
