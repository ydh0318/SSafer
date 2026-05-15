package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.context.ApplicationEventPublisher;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ScanFindingPatchApprovalServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private ScanFindingRepository scanFindingRepository;
  @Mock
  private AgentRepository agentRepository;
  @Mock
  private AgentTaskRepository agentTaskRepository;
  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private ApplicationEventPublisher applicationEventPublisher;

  @InjectMocks
  private ScanFindingPatchApprovalService scanFindingPatchApprovalService;

  @Test
  void approveCreatesPatchApplyTaskAndMarksFindingApproved() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", 501L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));
    when(agentRepository.findLatestByProjectIdAndStatus(project.getId(), AgentStatus.ONLINE))
        .thenReturn(Optional.of(agent));
    when(agentTaskRepository.save(any(AgentTask.class))).thenAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 701L);
      ReflectionTestUtils.setField(task, "queuedAt", java.time.Instant.parse("2026-05-08T04:00:00Z"));
      return task;
    });

    ScanFindingPatchApprovalResult result = scanFindingPatchApprovalService.approve(scan.getId(), finding.getId());

    ArgumentCaptor<AgentTask> taskCaptor = ArgumentCaptor.forClass(AgentTask.class);
    verify(agentTaskRepository).save(taskCaptor.capture());
    assertThat(taskCaptor.getValue().getTaskType()).isEqualTo(AgentTaskType.PATCH_APPLY);
    assertThat(taskCaptor.getValue().getTaskStatus()).isEqualTo(AgentTaskStatus.PENDING);
    assertThat(taskCaptor.getValue().getPayloadJson()).isEqualTo(finding.getPatchPayloadJson());
    assertThat(taskCaptor.getValue().getFinding()).isEqualTo(finding);
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.IN_PROGRESS);
    assertThat(finding.getPatchApprovedActorType()).isEqualTo(RequestActorType.USER);
    assertThat(finding.getPatchApprovedByUserId()).isEqualTo(1L);
    assertThat(finding.getPatchApprovedByGuestOwnerKeyHash()).isNull();
    assertThat(finding.getPatchApprovedAt()).isNotNull();
    assertThat(result.agentTaskId()).isEqualTo(701L);
    assertThat(result.agentId()).isEqualTo(501L);
    verify(applicationEventPublisher).publishEvent(any(com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent.class));
  }

  @Test
  void approveForGuestStoresNullApproverId() {
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-owner");
    Project project = new Project(null, "guest-owner", "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", 502L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));
    when(agentRepository.findLatestByProjectIdAndStatus(project.getId(), AgentStatus.ONLINE))
        .thenReturn(Optional.of(agent));
    when(agentTaskRepository.save(any(AgentTask.class))).thenAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 702L);
      ReflectionTestUtils.setField(task, "queuedAt", java.time.Instant.parse("2026-05-08T04:00:10Z"));
      return task;
    });

    ScanFindingPatchApprovalResult result = scanFindingPatchApprovalService.approve(scan.getId(), finding.getId());

    verify(agentRepository, never()).save(any(Agent.class));
    assertThat(finding.getPatchApprovedActorType()).isEqualTo(RequestActorType.GUEST);
    assertThat(finding.getPatchApprovedByUserId()).isNull();
    assertThat(finding.getPatchApprovedByGuestOwnerKeyHash()).isEqualTo("guest-owner");
    assertThat(result.agentId()).isEqualTo(502L);
  }

  @Test
  void approveWhenProjectHasOnlyOfflineAgentThrowsAgentOfflineAndDoesNotCreateTask() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");
    Agent offlineAgent = new Agent(project, AgentStatus.OFFLINE);
    ReflectionTestUtils.setField(offlineAgent, "id", 501L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));
    when(agentRepository.findLatestByProjectIdAndStatus(project.getId(), AgentStatus.ONLINE))
        .thenReturn(Optional.empty());
    when(agentRepository.findFirstByProjectId(project.getId())).thenReturn(Optional.of(offlineAgent));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.AGENT_OFFLINE);

    verify(agentTaskRepository, never()).save(any(AgentTask.class));
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(finding.getPatchApprovedAt()).isNull();
  }

  @Test
  void approveWhenProjectHasNoAgentThrowsAgentNotFoundAndDoesNotCreateTask() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));
    when(agentRepository.findLatestByProjectIdAndStatus(project.getId(), AgentStatus.ONLINE))
        .thenReturn(Optional.empty());
    when(agentRepository.findFirstByProjectId(project.getId())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.AGENT_NOT_FOUND);

    verify(agentTaskRepository, never()).save(any(AgentTask.class));
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(finding.getPatchApprovedAt()).isNull();
  }

  @Test
  void approveWhenPatchPayloadMissingThrowsConflict() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, null);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PATCH_PAYLOAD_NOT_FOUND);
  }

  @Test
  void approveWhenFindingIsNotOpenThrowsConflict() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.RESOLVED, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PATCH_APPROVAL_NOT_ALLOWED);
  }

  @Test
  void approveWhenScanIsNotDoneThrowsConflict() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(project.getId())
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.RUNNING)
        .requestedAt(LocalDateTime.of(2026, 5, 8, 10, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 8, 10, 5))
        .build();
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_STATUS_CONFLICT);
  }

  @Test
  void approveWhenServerAuditScanThrowsNotAllowed() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ReflectionTestUtils.setField(scan, "scanType", ScanType.SERVER_AUDIT);
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PATCH_APPROVAL_NOT_ALLOWED);
  }

  @Test
  void approveWhenUploadScanThrowsNotAllowed() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = new Project(1L, null, "project", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 101L);
    Scan scan = scan(project.getId());
    ReflectionTestUtils.setField(scan, "scanMode", com.ssafer.scan.domain.enums.ScanMode.UPLOAD);
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN, "{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(project.getId(), actor)).thenReturn(project);
    when(scanFindingRepository.findByIdAndScanIdForUpdate(finding.getId(), scan.getId())).thenReturn(Optional.of(finding));

    assertThatThrownBy(() -> scanFindingPatchApprovalService.approve(scan.getId(), finding.getId()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UPLOAD_PATCH_NOT_ALLOWED);
  }

  private Scan scan(Long projectId) {
    return Scan.builder()
        .id(1001L)
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 5, 8, 10, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 8, 10, 5))
        .build();
  }

  private ScanFinding finding(Long scanId, ResolutionStatus resolutionStatus, String patchPayloadJson) {
    return ScanFinding.builder()
        .id(2001L)
        .scanId(scanId)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("FND-0001")
        .severity(Severity.HIGH)
        .category("CONFIG")
        .title("Image user should not be 'root'")
        .patchPayloadJson(patchPayloadJson)
        .resolutionStatus(resolutionStatus)
        .createdAt(LocalDateTime.of(2026, 5, 8, 10, 1))
        .build();
  }
}
