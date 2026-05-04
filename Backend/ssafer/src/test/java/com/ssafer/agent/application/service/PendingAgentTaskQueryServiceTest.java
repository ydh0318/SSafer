package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

class PendingAgentTaskQueryServiceTest {

  private AgentRepository agentRepository;
  private AgentTaskRepository agentTaskRepository;
  private PendingAgentTaskQueryService service;

  @BeforeEach
  void setUp() {
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTaskRepository = Mockito.mock(AgentTaskRepository.class);
    service = new PendingAgentTaskQueryService(agentRepository, agentTaskRepository, new ObjectMapper());
  }

  @Test
  void getPendingTasksReturnsIncompleteTasks() {
    Agent agent = buildAgent(1L, 10L);
    AgentTask first = buildTask(101L, agent, AgentTaskStatus.PENDING, "{\"action\":\"A\"}",
        Instant.parse("2026-04-23T09:00:00Z"));
    AgentTask second = buildTask(102L, agent, AgentTaskStatus.SENT, "{\"action\":\"B\"}",
        Instant.parse("2026-04-23T09:03:00Z"));
    AgentTask third = buildTask(103L, agent, AgentTaskStatus.ACKED, "{\"action\":\"C\"}",
        Instant.parse("2026-04-23T09:06:00Z"));
    AgentTask fourth = buildTask(104L, agent, AgentTaskStatus.RUNNING, "{\"action\":\"D\"}",
        Instant.parse("2026-04-23T09:09:00Z"));

    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        Mockito.eq(1L),
        Mockito.anyCollection()
    )).willReturn(List.of(first, second, third, fourth));

    List<PendingAgentTaskResponseData> result = service.getPendingTasks(1L, 1L);

    ArgumentCaptor<java.util.Collection<AgentTaskStatus>> statusCaptor = ArgumentCaptor.forClass(java.util.Collection.class);
    Mockito.verify(agentTaskRepository).findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(Mockito.eq(1L), statusCaptor.capture());

    assertThat(statusCaptor.getValue()).containsExactlyInAnyOrder(
        AgentTaskStatus.PENDING,
        AgentTaskStatus.SENT,
        AgentTaskStatus.ACKED,
        AgentTaskStatus.RUNNING
    );

    assertThat(result).hasSize(4);
    assertThat(result.get(0).taskId()).isEqualTo(101L);
    assertThat(result.get(0).taskStatus()).isEqualTo(AgentTaskStatus.PENDING);
    assertThat(result.get(1).taskId()).isEqualTo(102L);
    assertThat(result.get(1).taskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(result.get(2).taskId()).isEqualTo(103L);
    assertThat(result.get(2).taskStatus()).isEqualTo(AgentTaskStatus.ACKED);
    assertThat(result.get(3).taskId()).isEqualTo(104L);
    assertThat(result.get(3).taskStatus()).isEqualTo(AgentTaskStatus.RUNNING);
  }

  @Test
  void getPendingTasksThrowsNotFoundWhenAgentMissing() {
    given(agentRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getPendingTasks(1L, 1L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getPendingTasksThrowsForbiddenWhenAgentIdMismatch() {
    Agent agent = buildAgent(1L, 10L);
    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));

    assertThatThrownBy(() -> service.getPendingTasks(1L, 2L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  private Agent buildAgent(Long agentId, Long projectId) {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }

  private AgentTask buildTask(Long taskId, Agent agent, AgentTaskStatus status, String payload, Instant queuedAt) {
    Scan scan = Scan.builder()
        .projectId(agent.getProject().getId())
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();
    ReflectionTestUtils.setField(scan, "id", 55L);

    AgentTask task = new AgentTask(agent, agent.getProject(), scan, null, AgentTaskType.PATCH_APPLY, status, payload);
    ReflectionTestUtils.setField(task, "id", taskId);
    ReflectionTestUtils.setField(task, "queuedAt", queuedAt);
    return task;
  }
}

