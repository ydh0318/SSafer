package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.entity.ScanNode;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultPersistenceServiceTest {

  private static final String ANALYSIS_RESULT_JSON = """
      {
        "schemaVersion": "0.2",
        "scanId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
        "source": "cli",
        "scannedAt": "2026-04-27T00:26:05Z",
        "generatedAt": "2026-05-04T01:57:29.596745+00:00",
        "resultCount": 3,
        "results": [
          {
            "findingId": "FND-0001",
            "ruleId": "ENV_PLAIN_SECRET",
            "source": "custom-rule",
            "severity": "HIGH",
            "file": ".env",
            "line": 1,
            "title": "환경변수 파일에 시크릿이 하드코딩됨: DB_PASSWORD",
            "maskedEvidence": "DB_PASSWORD=***MASKED***",
            "explanation": "설명 1",
            "fix": {
              "summary": "fix summary 1",
              "priority": "high",
              "recommendedActions": ["action-1", "action-2"],
              "codeGuidance": "code guidance 1",
              "verification": "verification 1",
              "cautions": ["caution-1"],
              "patches": [
                {
                  "patchId": "PATCH-0001",
                  "targetFile": ".env",
                  "operation": "replace",
                  "oldText": "DB_PASSWORD=plain-text",
                  "newText": "DB_PASSWORD=${DB_PASSWORD}",
                  "expectedFileHash": "sha256:abc123...",
                  "requiresApproval": true,
                  "rollback": {
                    "operation": "replace",
                    "oldText": "DB_PASSWORD=${DB_PASSWORD}",
                    "newText": "DB_PASSWORD=plain-text"
                  }
                }
              ]
            }
          },
          {
            "findingId": "FND-0002",
            "ruleId": "DS-0002",
            "source": "trivy",
            "severity": "HIGH",
            "file": "Dockerfile",
            "line": null,
            "title": "Image user should not be root",
            "maskedEvidence": "Last USER command in Dockerfile should not be root",
            "explanation": "설명 2",
            "fix": {
              "summary": "fix summary 2",
              "priority": "high",
              "recommendedActions": ["action-3"],
              "codeGuidance": "code guidance 2",
              "verification": "verification 2",
              "cautions": ["caution-2"]
            }
          },
          {
            "findingId": "FND-0003",
            "ruleId": "DS-0026",
            "source": "trivy",
            "severity": "LOW",
            "file": "Dockerfile",
            "line": null,
            "title": "No HEALTHCHECK defined",
            "maskedEvidence": "Add HEALTHCHECK instruction",
            "explanation": "설명 3",
            "fix": {
              "summary": "fix summary 3",
              "priority": "low",
              "recommendedActions": ["action-4"],
              "codeGuidance": "code guidance 3",
              "verification": "verification 3",
              "cautions": ["caution-3"]
            }
          }
        ]
      }
      """;

  private static final String SERVER_AUDIT_ANALYSIS_RESULT_JSON = """
      {
        "schemaVersion": "0.2",
        "scanId": "server-audit-1",
        "source": "server-audit",
        "scannedAt": "2026-04-27T00:26:05Z",
        "generatedAt": "2026-05-04T01:57:29.596745+00:00",
        "resultCount": 1,
        "results": [
          {
            "findingId": "SRV-0001",
            "ruleId": "SSH-OPEN",
            "source": "server-audit",
            "severity": "HIGH",
            "file": "/etc/ssh/sshd_config",
            "line": 12,
            "title": "SSH port is publicly exposed",
            "maskedEvidence": "0.0.0.0:22",
            "explanation": "SSH is exposed to the public network",
            "fix": {
              "summary": "Restrict network access",
              "priority": "high",
              "recommendedActions": ["Check security group", "Restrict firewall rules"],
              "codeGuidance": "Review inbound rules",
              "verification": "Run firewall-cmd --list-all",
              "cautions": ["Coordinate maintenance window"]
            }
          }
        ]
      }
      """;

  private static final String LEGACY_ANALYSIS_RESULT_JSON = """
      {
        "schemaVersion": "0.1",
        "scanId": "legacy-scan-1",
        "source": "cli",
        "generatedAt": "2026-05-04T01:57:29.596745+00:00",
        "findings": [
          {
            "id": "FND-0001",
            "ruleId": "ENV_PLAIN_SECRET",
            "source": "custom-rule",
            "severity": "HIGH",
            "file": ".env",
            "filePath": "Backend\\\\ssafer\\\\.env",
            "targetFiles": ["Backend\\\\ssafer\\\\.env"],
            "line": 1,
            "title": "Legacy hardcoded secret",
            "maskedEvidence": "DB_PASSWORD=***MASKED***"
          }
        ]
      }
      """;

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private AgentTaskRepository agentTaskRepository;

  @Mock
  private ScanNodeRepository scanNodeRepository;

  @Mock
  private ScanFindingRepository scanFindingRepository;

  @Mock
  private AnalysisResultObjectReader analysisResultObjectReader;

  @Mock
  private ApplicationEventPublisher applicationEventPublisher;

  private WorkerAnalysisResultPersistenceService workerAnalysisResultPersistenceService;

  @BeforeEach
  void setUp() {
    workerAnalysisResultPersistenceService = new WorkerAnalysisResultPersistenceService(
        scanRepository,
        agentTaskRepository,
        scanNodeRepository,
        scanFindingRepository,
        analysisResultObjectReader,
        new ObjectMapper(),
        applicationEventPublisher
    );
  }

  @Test
  void persistSavesNodeAndFindingsAndMarksDone() throws Exception {
    Scan scan = runningScan();
    AgentTask task = ackedTask(scan);
    WorkerAnalysisResultIngestionRequestedEvent event = event();
    ScanNode savedNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd"))
        .thenReturn(Optional.empty());
    when(scanNodeRepository.save(any(ScanNode.class))).thenReturn(savedNode);
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of());
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(3L);

    workerAnalysisResultPersistenceService.persist(event);

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue()).hasSize(3);
    assertThat(findingsCaptor.getValue())
        .extracting(ScanFinding::getFingerprint)
        .allMatch(fingerprint -> fingerprint.startsWith("sha256:"));
    assertThat(findingsCaptor.getValue())
        .extracting(ScanFinding::getResourceName)
        .containsExactly(".env", "Dockerfile", "Dockerfile");
    JsonNode rawSnippet = new ObjectMapper().readTree(findingsCaptor.getValue().getFirst().getRawSnippetJson());
    assertThat(rawSnippet.path("findingId").asText()).isEqualTo("FND-0001");
    assertThat(rawSnippet.has("fix")).isTrue();
    JsonNode patchPayload = new ObjectMapper().readTree(findingsCaptor.getValue().getFirst().getPatchPayloadJson());
    assertThat(patchPayload.path("patches")).hasSize(1);
    assertThat(patchPayload.path("patches").get(0).path("patchId").asText()).isEqualTo("PATCH-0001");
    assertThat(findingsCaptor.getValue().get(1).getPatchPayloadJson()).isNull();
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.DONE);
    assertThat(scan.getProgressStep()).isEqualTo(WorkerAnalysisResultPersistenceService.COMPLETED_PROGRESS_STEP);
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.DONE));
  }

  @Test
  void persistSkipsWhenAlreadyCompleted() {
    Scan scan = completedScan();
    AgentTask task = succeededTask(scan);

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));

    workerAnalysisResultPersistenceService.persist(event());

    verify(analysisResultObjectReader, never()).read(any());
    verify(scanNodeRepository, never()).save(any());
    verify(scanFindingRepository, never()).saveAll(any());
  }

  @Test
  void persistRetrySavesOnlyMissingFindings() {
    Scan scan = runningScan();
    AgentTask task = runningTask(scan);
    ScanNode existingNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();
    ScanFinding existingFinding = ScanFinding.builder()
        .id(300L)
        .scanId(scan.getId())
        .scanNodeId(existingNode.getId())
        .sourceType(com.ssafer.scan.domain.enums.FindingSourceType.CUSTOM_RULE)
        .fingerprint("FND-0001")
        .severity(com.ssafer.scan.domain.enums.Severity.HIGH)
        .category("CUSTOM_RULE")
        .title("기존 finding")
        .resolutionStatus(com.ssafer.scan.domain.enums.ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd"))
        .thenReturn(Optional.of(existingNode));
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of(existingFinding));
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(3L);

    workerAnalysisResultPersistenceService.persist(event());

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue()).hasSize(2);
    assertThat(findingsCaptor.getValue())
        .extracting(ScanFinding::getTitle)
        .containsExactly("Image user should not be root", "No HEALTHCHECK defined");
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.DONE);
  }

  @Test
  void persistRetryBackfillsPatchPayloadForExistingFinding() {
    Scan scan = runningScan();
    AgentTask task = runningTask(scan);
    ScanNode existingNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();
    ScanFinding existingFinding = ScanFinding.builder()
        .id(300L)
        .scanId(scan.getId())
        .scanNodeId(existingNode.getId())
        .sourceType(com.ssafer.scan.domain.enums.FindingSourceType.CUSTOM_RULE)
        .fingerprint("FND-0001")
        .severity(com.ssafer.scan.domain.enums.Severity.HIGH)
        .category("CUSTOM_RULE")
        .title("기존 finding")
        .rawSnippetJson("{\"maskedEvidence\":\"DB_PASSWORD=***MASKED***\"}")
        .resolutionStatus(com.ssafer.scan.domain.enums.ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd"))
        .thenReturn(Optional.of(existingNode));
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of(existingFinding));
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(3L);

    workerAnalysisResultPersistenceService.persist(event());

    verify(scanFindingRepository).saveAll(any());
    assertThat(existingFinding.getPatchPayloadJson()).isNotBlank();
    assertThat(existingFinding.getPatchPayloadJson()).contains("PATCH-0001");
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.DONE);
  }

  @Test
  void persistSkipsPatchPayloadGenerationForServerAudit() {
    Scan scan = runningScan();
    ReflectionTestUtils.setField(scan, "scanType", ScanType.SERVER_AUDIT);
    AgentTask task = ackedTask(scan);
    WorkerAnalysisResultIngestionRequestedEvent event = event();
    ScanNode savedNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd"))
        .thenReturn(Optional.empty());
    when(scanNodeRepository.save(any(ScanNode.class))).thenReturn(savedNode);
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of());
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(3L);

    workerAnalysisResultPersistenceService.persist(event);

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue())
        .extracting(ScanFinding::getPatchPayloadJson)
        .containsOnlyNulls();
  }

  @Test
  void persistMapsServerAuditFindingSource() {
    Scan scan = runningScan();
    ReflectionTestUtils.setField(scan, "scanType", ScanType.SERVER_AUDIT);
    AgentTask task = ackedTask(scan);
    ScanNode savedNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("server-audit-1")
        .nodeName("server-audit")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(SERVER_AUDIT_ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "server-audit-1")).thenReturn(Optional.empty());
    when(scanNodeRepository.save(any(ScanNode.class))).thenReturn(savedNode);
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of());
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(1L);

    workerAnalysisResultPersistenceService.persist(event());

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue()).hasSize(1);
    assertThat(findingsCaptor.getValue().getFirst().getSourceType()).isEqualTo(FindingSourceType.SERVER_AUDIT);
    assertThat(findingsCaptor.getValue().getFirst().getPatchPayloadJson()).isNull();
  }

  @Test
  void persistSupportsLegacyFindingsArrayAndIdField() {
    Scan scan = runningScan();
    AgentTask task = ackedTask(scan);
    ScanNode savedNode = ScanNode.builder()
        .id(200L)
        .scanId(scan.getId())
        .nodeKey("legacy-scan-1")
        .nodeName("cli")
        .nodeType("ANALYSIS_RESULT")
        .metadataJson("{}")
        .createdAt(LocalDateTime.now())
        .build();

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));
    when(analysisResultObjectReader.read(scan.getAnalysisResultPath())).thenReturn(LEGACY_ANALYSIS_RESULT_JSON);
    when(scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), "legacy-scan-1"))
        .thenReturn(Optional.empty());
    when(scanNodeRepository.save(any(ScanNode.class))).thenReturn(savedNode);
    when(scanFindingRepository.findAllByScanId(scan.getId())).thenReturn(List.of());
    when(scanFindingRepository.countByScanId(scan.getId())).thenReturn(1L);

    workerAnalysisResultPersistenceService.persist(event());

    ArgumentCaptor<List<ScanFinding>> findingsCaptor = ArgumentCaptor.forClass(List.class);
    verify(scanFindingRepository).saveAll(findingsCaptor.capture());
    assertThat(findingsCaptor.getValue()).hasSize(1);
    assertThat(findingsCaptor.getValue().getFirst().getFingerprint()).startsWith("sha256:");
    assertThat(findingsCaptor.getValue().getFirst().getFilePath()).isEqualTo("Backend\\ssafer\\.env");
    JsonNode rawSnippet = new ObjectMapper().readTree(findingsCaptor.getValue().getFirst().getRawSnippetJson());
    assertThat(rawSnippet.path("id").asText()).isEqualTo("FND-0001");
    assertThat(rawSnippet.path("filePath").asText()).isEqualTo("Backend\\ssafer\\.env");
    assertThat(rawSnippet.path("targetFiles")).hasSize(1);
  }

  @Test
  void markFailedMarksTaskAndScanFailed() {
    Scan scan = runningScan();
    AgentTask task = ackedTask(scan);

    when(scanRepository.findByIdForUpdate(scan.getId())).thenReturn(Optional.of(scan));
    when(agentTaskRepository.findByIdAndScanId(task.getId(), scan.getId())).thenReturn(Optional.of(task));

    workerAnalysisResultPersistenceService.markFailed(event(), new IllegalStateException("temporary s3 failure"));

    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.FAILED);
    assertThat(task.getFailureReason()).contains("temporary s3 failure");
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(scan.getProgressStep()).isEqualTo(WorkerAnalysisResultPersistenceService.FAILED_PROGRESS_STEP);
    assertThat(scan.getFailureReason()).contains("temporary s3 failure");
    assertThat(scan.getCompletedAt()).isNotNull();
    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  private WorkerAnalysisResultIngestionRequestedEvent event() {
    return new WorkerAnalysisResultIngestionRequestedEvent(
        1L,
        100L,
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
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
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
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .analysisResultPath("s3://ssafer/result/1/analysis_result.json")
        .requestedAt(LocalDateTime.of(2026, 5, 6, 10, 0))
        .startedAt(LocalDateTime.of(2026, 5, 6, 10, 1))
        .completedAt(LocalDateTime.of(2026, 5, 6, 10, 5))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 6, 10, 5))
        .build();
  }

  private AgentTask ackedTask(Scan scan) {
    AgentTask task = baseTask(scan);
    ReflectionTestUtils.setField(task, "id", 100L);
    task.markSent(Instant.now());
    task.markAcked(Instant.now());
    return task;
  }

  private AgentTask runningTask(Scan scan) {
    AgentTask task = ackedTask(scan);
    task.markRunning(Instant.now());
    return task;
  }

  private AgentTask succeededTask(Scan scan) {
    AgentTask task = runningTask(scan);
    task.markSucceeded(Instant.now());
    return task;
  }

  private AgentTask baseTask(Scan scan) {
    return new AgentTask(agent(), project(), scan, null, AgentTaskType.SCAN_REQUEST, AgentTaskStatus.PENDING, null);
  }

  private Agent agent() {
    return new Agent(project(), AgentStatus.ONLINE);
  }

  private Project project() {
    return new Project(20L, null, "test-project", null, ScanMode.AGENT, false);
  }
}
