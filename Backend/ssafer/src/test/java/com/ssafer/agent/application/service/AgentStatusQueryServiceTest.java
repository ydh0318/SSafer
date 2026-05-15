package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.agent.api.dto.AgentStatusResponseData;
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
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class AgentStatusQueryServiceTest {

  private ProjectAuthorizationService projectAuthorizationService;
  private AgentRepository agentRepository;
  private AgentTaskRepository agentTaskRepository;
  private AgentStatusQueryService agentStatusQueryService;

  @BeforeEach
  void setUp() {
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTaskRepository = Mockito.mock(AgentTaskRepository.class);
    agentStatusQueryService = new AgentStatusQueryService(
        projectAuthorizationService,
        agentRepository,
        agentTaskRepository
    );
  }

  @Test
  void getAgentStatusReturnsCurrentTaskTypeWhenIncompleteTaskExists() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Agent agent = buildAgent(10L, AgentStatus.ONLINE);
    AgentTask task = buildTask(agent, AgentTaskType.PATCH_APPLY, AgentTaskStatus.RUNNING);

    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findFirstByAgentIdAndTaskStatusInOrderByQueuedAtDescIdDesc(
        agent.getId(),
        List.of(AgentTaskStatus.PENDING, AgentTaskStatus.SENT, AgentTaskStatus.ACKED, AgentTaskStatus.RUNNING)
    )).willReturn(Optional.of(task));

    AgentStatusResponseData result = agentStatusQueryService.getAgentStatus(10L, actor);

    assertThat(result.agentId()).isEqualTo(agent.getId());
    assertThat(result.status()).isEqualTo(AgentStatus.ONLINE);
    assertThat(result.currentTaskType()).isEqualTo(AgentTaskType.PATCH_APPLY);
  }

  @Test
  void getAgentStatusReturnsNullWhenIncompleteTaskDoesNotExist() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Agent agent = buildAgent(10L, AgentStatus.ONLINE);

    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findFirstByAgentIdAndTaskStatusInOrderByQueuedAtDescIdDesc(
        agent.getId(),
        List.of(AgentTaskStatus.PENDING, AgentTaskStatus.SENT, AgentTaskStatus.ACKED, AgentTaskStatus.RUNNING)
    )).willReturn(Optional.empty());

    AgentStatusResponseData result = agentStatusQueryService.getAgentStatus(10L, actor);

    assertThat(result.currentTaskType()).isNull();
  }

  @Test
  void getAgentStatusThrowsNotFoundWhenAgentDoesNotExist() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.empty());

    assertThatThrownBy(() -> agentStatusQueryService.getAgentStatus(10L, actor))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  private Agent buildAgent(Long projectId, AgentStatus status) {
    Project project = new Project(1L, null, "test-project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    Agent agent = new Agent(project, status);
    ReflectionTestUtils.setField(agent, "id", 1L);
    return agent;
  }

  private AgentTask buildTask(Agent agent, AgentTaskType taskType, AgentTaskStatus taskStatus) {
    Project project = agent.getProject();
    Scan scan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();
    ReflectionTestUtils.setField(scan, "id", 100L);
    return new AgentTask(agent, project, scan, null, taskType, taskStatus, "{}");
  }
}

