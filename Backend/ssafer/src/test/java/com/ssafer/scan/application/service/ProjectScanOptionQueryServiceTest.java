package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.api.dto.ProjectScanOptionsResponseData;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectScanOptionQueryServiceTest {

  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private AgentRepository agentRepository;

  @InjectMocks
  private ProjectScanOptionQueryService projectScanOptionQueryService;

  @Test
  void getScanOptionsWhenAgentOnlineReturnsUploadAndAgent() {
    // ONLINE Local Agent가 있으면 AGENT 모드가 available 목록에 포함되어야 한다.
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = createProject(101L, ScanMode.UPLOAD, true);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, actor)).thenReturn(project);
    when(agentRepository.findLatestByProjectIdAndStatus(101L, AgentStatus.ONLINE))
        .thenReturn(Optional.of(createAgent(project)));

    ProjectScanOptionsResponseData response = projectScanOptionQueryService.getScanOptions(101L);

    assertThat(response.defaultScanMode()).isEqualTo(ScanMode.UPLOAD);
    assertThat(response.availableScanModes()).containsExactly(ScanMode.UPLOAD, ScanMode.AGENT);
    assertThat(response.monitorEnabled()).isTrue();
    assertThat(response.agentAvailable()).isTrue();
  }

  @Test
  void getScanOptionsWhenNoOnlineAgentReturnsUploadOnly() {
    // 기본 모드(defaultScanMode)는 AGENT여도, 현재 가용 목록은 UPLOAD만 내려와야 한다.
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = createProject(101L, ScanMode.AGENT, true);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, actor)).thenReturn(project);
    when(agentRepository.findLatestByProjectIdAndStatus(101L, AgentStatus.ONLINE)).thenReturn(Optional.empty());

    ProjectScanOptionsResponseData response = projectScanOptionQueryService.getScanOptions(101L);

    assertThat(response.defaultScanMode()).isEqualTo(ScanMode.AGENT);
    assertThat(response.availableScanModes()).containsExactly(ScanMode.UPLOAD);
    assertThat(response.monitorEnabled()).isTrue();
    assertThat(response.agentAvailable()).isFalse();
  }

  @Test
  void getScanOptionsWhenForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> projectScanOptionQueryService.getScanOptions(101L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void getScanOptionsWhenProjectMissingThrowsNotFound() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    doThrow(new BusinessException(ErrorCode.NOT_FOUND))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> projectScanOptionQueryService.getScanOptions(101L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanOptionsChecksLatestOnlineAgent() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = createProject(101L, ScanMode.UPLOAD, false);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, actor)).thenReturn(project);
    when(agentRepository.findLatestByProjectIdAndStatus(101L, AgentStatus.ONLINE)).thenReturn(Optional.empty());

    projectScanOptionQueryService.getScanOptions(101L);

    org.mockito.Mockito.verify(agentRepository).findLatestByProjectIdAndStatus(101L, AgentStatus.ONLINE);
  }

  private Project createProject(Long projectId, ScanMode defaultScanMode, boolean monitorEnabled) {
    Project project = new Project(1L, null, "test-project", null, defaultScanMode, monitorEnabled);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Agent createAgent(Project project) {
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", 1L);
    return agent;
  }
}
