package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.api.dto.AgentTaskResultReportRequest;
import com.ssafer.agent.api.dto.AgentTaskResultReportRequest.PatchResultItem;
import com.ssafer.agent.api.dto.AgentTaskResultReportRequest.PatchResultStatus;
import com.ssafer.agent.api.dto.AgentTaskResultReportResponseData;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.application.service.ScanStatusSsePublishRequestedEvent;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

class AgentTaskResultReportServiceTest {

  private AgentTaskRepository agentTaskRepository;
  private ApplicationEventPublisher applicationEventPublisher;
  private AgentTaskResultReportService service;

  @BeforeEach
  void setUp() {
    agentTaskRepository = Mockito.mock(AgentTaskRepository.class);
    applicationEventPublisher = Mockito.mock(ApplicationEventPublisher.class);
    service = new AgentTaskResultReportService(agentTaskRepository, new ObjectMapper(), applicationEventPublisher);
  }

  @Test
  void reportResultWhenSucceededMarksTaskSucceededAndFindingResolved() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.SENT, AgentTaskType.PATCH_APPLY, createFinding(100L));
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));

    AgentTaskResultReportResponseData response = service.reportResult(
        1L,
        1L,
        10L,
        new AgentTaskResultReportRequest(
            AgentTaskStatus.SUCCEEDED,
            "Applied 1 patch candidate(s).",
            List.of(new PatchResultItem(
                "PATCH-FND-0001",
                "Dockerfile",
                PatchResultStatus.SUCCESS,
                "Patch applied successfully.",
                ".ssafer/backups/Dockerfile.20260507120000.bak"
            ))
        )
    );

    ScanFinding finding = task.getFinding();
    assertThat(response.taskId()).isEqualTo(10L);
    assertThat(response.taskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(response.findingId()).isEqualTo(100L);
    assertThat(response.resolutionStatus()).isEqualTo(ResolutionStatus.RESOLVED);
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(task.getAckedAt()).isNotNull();
    assertThat(task.getStartedAt()).isNotNull();
    assertThat(task.getCompletedAt()).isNotNull();
    assertThat(task.getFailureReason()).isNull();
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.RESOLVED);
    assertThat(finding.getPatchedAt()).isNotNull();
    assertThat(finding.getPatchResultMessage()).isEqualTo("Applied 1 patch candidate(s).");
    assertThat(finding.getBackupFileName()).isEqualTo("Dockerfile.20260507120000.bak");
    assertThat(finding.getBackupFilePath()).isEqualTo(".ssafer/backups/Dockerfile.20260507120000.bak");
    assertThat(finding.getBackupMetadataJson()).contains("PATCH-FND-0001");
  }

  @Test
  void reportResultWhenFailedMarksTaskFailedAndFindingOpen() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.ACKED, AgentTaskType.PATCH_APPLY, createFinding(100L));
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));

    AgentTaskResultReportResponseData response = service.reportResult(
        1L,
        1L,
        10L,
        new AgentTaskResultReportRequest(
            AgentTaskStatus.FAILED,
            "Patch target file not found.",
            List.of(new PatchResultItem(
                "PATCH-FND-0001",
                "Dockerfile",
                PatchResultStatus.FAILED,
                "Patch target file not found.",
                null
            ))
        )
    );

    ScanFinding finding = task.getFinding();
    assertThat(response.taskStatus()).isEqualTo(AgentTaskStatus.FAILED);
    assertThat(response.resolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.FAILED);
    assertThat(task.getStartedAt()).isNotNull();
    assertThat(task.getCompletedAt()).isNotNull();
    assertThat(task.getFailureReason()).isEqualTo("Patch target file not found.");
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(finding.getPatchedAt()).isNull();
    assertThat(finding.getPatchResultMessage()).isEqualTo("Patch target file not found.");
    assertThat(finding.getBackupFileName()).isNull();
    assertThat(finding.getBackupFilePath()).isNull();
    assertThat(finding.getBackupMetadataJson()).contains("PATCH-FND-0001");
  }

  @Test
  void reportResultWhenAgentIdMismatchThrowsForbidden() {
    AgentTaskResultReportRequest request = new AgentTaskResultReportRequest(
        AgentTaskStatus.FAILED,
        "failed",
        List.of()
    );

    assertBusinessException(() -> service.reportResult(1L, 2L, 10L, request), ErrorCode.FORBIDDEN);
    verify(agentTaskRepository, never()).findByIdAndAgentIdForUpdate(anyLong(), anyLong());
  }

  @Test
  void reportResultWhenTaskMissingThrowsNotFound() {
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.empty());
    AgentTaskResultReportRequest request = new AgentTaskResultReportRequest(
        AgentTaskStatus.FAILED,
        "failed",
        List.of()
    );

    assertBusinessException(() -> service.reportResult(1L, 1L, 10L, request), ErrorCode.NOT_FOUND);
  }

  @Test
  void reportResultWhenScanRequestSucceededMarksTaskSucceededWithoutFinding() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.SENT, AgentTaskType.SCAN_REQUEST, null);
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));

    AgentTaskResultReportResponseData response = service.reportResult(
        1L,
        1L,
        10L,
        new AgentTaskResultReportRequest(
            AgentTaskStatus.SUCCEEDED,
            "Scan completed and uploaded.",
            List.of()
        )
    );

    assertThat(response.taskId()).isEqualTo(10L);
    assertThat(response.taskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(response.findingId()).isNull();
    assertThat(response.resolutionStatus()).isNull();
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(task.getAckedAt()).isNotNull();
    assertThat(task.getStartedAt()).isNotNull();
    assertThat(task.getCompletedAt()).isNotNull();
    assertThat(task.getFailureReason()).isNull();
    assertThat(task.getScan().getStatus()).isEqualTo(ScanStatus.REQUESTED);
    verify(applicationEventPublisher, never()).publishEvent(Mockito.any());
  }

  @Test
  void reportResultWhenScanRequestFailedMarksTaskAndScanFailedWithoutFinding() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.ACKED, AgentTaskType.SCAN_REQUEST, null);
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));

    AgentTaskResultReportResponseData response = service.reportResult(
        1L,
        1L,
        10L,
        new AgentTaskResultReportRequest(
            AgentTaskStatus.FAILED,
            "SCAN_REQUEST failed: raw upload failed",
            List.of()
        )
    );

    assertThat(response.taskId()).isEqualTo(10L);
    assertThat(response.taskStatus()).isEqualTo(AgentTaskStatus.FAILED);
    assertThat(response.findingId()).isNull();
    assertThat(response.resolutionStatus()).isNull();
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.FAILED);
    assertThat(task.getStartedAt()).isNotNull();
    assertThat(task.getCompletedAt()).isNotNull();
    assertThat(task.getFailureReason()).isEqualTo("SCAN_REQUEST failed: raw upload failed");
    assertThat(task.getScan().getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(task.getScan().getProgressStep()).isEqualTo("SCAN_REQUEST_FAILED");
    assertThat(task.getScan().getFailureReason()).isEqualTo("SCAN_REQUEST failed: raw upload failed");
    assertThat(task.getScan().getCompletedAt()).isNotNull();
    verify(applicationEventPublisher).publishEvent(
        new ScanStatusSsePublishRequestedEvent(55L, ScanStatus.FAILED)
    );
  }

  @Test
  void reportResultWhenTaskAlreadyFinishedThrowsTaskStatusConflict() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.SUCCEEDED, AgentTaskType.PATCH_APPLY, createFinding(100L));
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));
    AgentTaskResultReportRequest request = new AgentTaskResultReportRequest(
        AgentTaskStatus.FAILED,
        "duplicate",
        List.of()
    );

    assertBusinessException(() -> service.reportResult(1L, 1L, 10L, request), ErrorCode.TASK_STATUS_CONFLICT);
  }

  @Test
  void reportResultWhenSucceededWithoutPatchResultsThrowsInvalidParameter() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.RUNNING, AgentTaskType.PATCH_APPLY, createFinding(100L));
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));
    AgentTaskResultReportRequest request = new AgentTaskResultReportRequest(
        AgentTaskStatus.SUCCEEDED,
        "success",
        List.of()
    );

    assertBusinessException(() -> service.reportResult(1L, 1L, 10L, request), ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void reportResultWhenSucceededWithFailedPatchResultThrowsInvalidParameter() {
    AgentTask task = createTask(10L, 1L, AgentTaskStatus.RUNNING, AgentTaskType.PATCH_APPLY, createFinding(100L));
    when(agentTaskRepository.findByIdAndAgentIdForUpdate(10L, 1L)).thenReturn(Optional.of(task));
    AgentTaskResultReportRequest request = new AgentTaskResultReportRequest(
        AgentTaskStatus.SUCCEEDED,
        "success",
        List.of(new PatchResultItem("PATCH-FND-0001", "Dockerfile", PatchResultStatus.FAILED, "failed", null))
    );

    assertBusinessException(() -> service.reportResult(1L, 1L, 10L, request), ErrorCode.INVALID_PARAMETER);
  }

  private static void assertBusinessException(Runnable action, ErrorCode expectedErrorCode) {
    assertThatThrownBy(action::run)
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(expectedErrorCode);
  }

  private AgentTask createTask(
      Long taskId,
      Long agentId,
      AgentTaskStatus status,
      AgentTaskType taskType,
      ScanFinding finding
  ) {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    Scan scan = Scan.builder()
        .id(55L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(taskType == AgentTaskType.SCAN_REQUEST ? ScanStatus.REQUESTED : ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 5, 11, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 9, 3))
        .build();
    AgentTask task = new AgentTask(agent, project, scan, finding, taskType, status, "{\"patches\":[]}");
    ReflectionTestUtils.setField(task, "id", taskId);
    return task;
  }

  private ScanFinding createFinding(Long findingId) {
    ScanFinding finding = ScanFinding.builder()
        .id(findingId)
        .scanId(55L)
        .scanNodeId(77L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("fingerprint-" + findingId)
        .severity(Severity.HIGH)
        .category("TRIVY")
        .title("Patch target")
        .filePath("Dockerfile")
        .ruleCode("RULE-1")
        .resolutionStatus(ResolutionStatus.IN_PROGRESS)
        .createdAt(LocalDateTime.of(2026, 5, 11, 9, 5))
        .build();
    ReflectionTestUtils.setField(finding, "id", findingId);
    return finding;
  }
}
