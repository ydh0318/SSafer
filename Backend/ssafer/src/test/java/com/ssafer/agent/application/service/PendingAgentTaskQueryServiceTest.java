package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

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
import com.ssafer.scan.application.service.RawUploadUrlIssuer;
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
  private RawUploadUrlIssuer rawUploadUrlIssuer;
  private PendingAgentTaskQueryService service;

  @BeforeEach
  void setUp() {
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTaskRepository = Mockito.mock(AgentTaskRepository.class);
    rawUploadUrlIssuer = Mockito.mock(RawUploadUrlIssuer.class);
    service = new PendingAgentTaskQueryService(agentRepository, agentTaskRepository, rawUploadUrlIssuer, new ObjectMapper());
  }

  @Test
  void getPendingTasksReturnsOnlyPendingTasksAndMarksThemSent() {
    Agent agent = buildAgent(1L, 10L);
    AgentTask first = buildTask(101L, agent, AgentTaskStatus.PENDING, "{\"action\":\"A\"}",
        Instant.parse("2026-04-23T09:00:00Z"));

    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        Mockito.eq(1L),
        Mockito.anyCollection()
    )).willReturn(List.of(first));

    List<PendingAgentTaskResponseData> result = service.getPendingTasks(1L, 1L);

    ArgumentCaptor<java.util.Collection<AgentTaskStatus>> statusCaptor = ArgumentCaptor.forClass(java.util.Collection.class);
    Mockito.verify(agentTaskRepository).findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(Mockito.eq(1L), statusCaptor.capture());

    assertThat(statusCaptor.getValue()).containsExactly(AgentTaskStatus.PENDING, AgentTaskStatus.SENT);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).taskId()).isEqualTo(101L);
    assertThat(result.get(0).taskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(first.getTaskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(first.getSentAt()).isNotNull();
  }

  @Test
  void getPendingTasksParsesScanRequestPayloadForLocalAgentScan() {
    Agent agent = buildAgent(1L, 10L);
    AgentTask task = buildTask(
        101L,
        agent,
        AgentTaskStatus.PENDING,
        """
            {
              "targetPath": "/opt/app",
              "scanName": "운영 서버 점검",
              "scanType": "SERVER_AUDIT",
              "includeLogs": false,
              "rawResultPath": "s3://ssafer/raw/55/upload/scan_result.json"
            }
            """,
        Instant.parse("2026-04-23T09:00:00Z"),
        AgentTaskType.SCAN_REQUEST
    );

    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        Mockito.eq(1L),
        Mockito.anyCollection()
    )).willReturn(List.of(task));
    given(rawUploadUrlIssuer.issuePutUrl("raw/55/upload/scan_result.json"))
        .willReturn("https://upload.example.com/fresh-raw-url");

    List<PendingAgentTaskResponseData> result = service.getPendingTasks(1L, 1L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).taskType()).isEqualTo(AgentTaskType.SCAN_REQUEST);
    assertThat(result.get(0).taskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(result.get(0).payload().get("targetPath").asText()).isEqualTo("/opt/app");
    assertThat(result.get(0).payload().get("scanName").asText()).isEqualTo("운영 서버 점검");
    assertThat(result.get(0).payload().get("scanType").asText()).isEqualTo("SERVER_AUDIT");
    assertThat(result.get(0).payload().get("includeLogs").asBoolean()).isFalse();
    assertThat(result.get(0).payload().get("rawResultPath").asText()).isEqualTo("s3://ssafer/raw/55/upload/scan_result.json");
    assertThat(result.get(0).payload().get("rawUploadUrl").asText()).isEqualTo("https://upload.example.com/fresh-raw-url");
  }

  @Test
  void getPendingTasksReturnsSentTaskAgainWithoutChangingStatus() {
    Agent agent = buildAgent(1L, 10L);
    AgentTask task = buildTask(
        101L,
        agent,
        AgentTaskStatus.SENT,
        "{\"targetPath\":\"/opt/app\"}",
        Instant.parse("2026-04-23T09:00:00Z"),
        AgentTaskType.SCAN_REQUEST
    );

    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        Mockito.eq(1L),
        Mockito.anyCollection()
    )).willReturn(List.of(task));

    List<PendingAgentTaskResponseData> result = service.getPendingTasks(1L, 1L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).taskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(task.getSentAt()).isNull();
  }

  @Test
  void getPendingTasksDoesNotAppendRawUploadUrlForNonScanRequestTask() {
    Agent agent = buildAgent(1L, 10L);
    AgentTask task = buildTask(
        101L,
        agent,
        AgentTaskStatus.PENDING,
        "{\"action\":\"PATCH_APPLY\"}",
        Instant.parse("2026-04-23T09:00:00Z"),
        AgentTaskType.PATCH_APPLY
    );

    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        Mockito.eq(1L),
        Mockito.anyCollection()
    )).willReturn(List.of(task));

    List<PendingAgentTaskResponseData> result = service.getPendingTasks(1L, 1L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).taskType()).isEqualTo(AgentTaskType.PATCH_APPLY);
    assertThat(result.get(0).payload().get("action").asText()).isEqualTo("PATCH_APPLY");
    verify(rawUploadUrlIssuer, never()).issuePutUrl(Mockito.anyString());
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
    return buildTask(taskId, agent, status, payload, queuedAt, AgentTaskType.PATCH_APPLY);
  }

  private AgentTask buildTask(
      Long taskId,
      Agent agent,
      AgentTaskStatus status,
      String payload,
      Instant queuedAt,
      AgentTaskType taskType
  ) {
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

    AgentTask task = new AgentTask(agent, agent.getProject(), scan, null, taskType, status, payload);
    ReflectionTestUtils.setField(task, "id", taskId);
    ReflectionTestUtils.setField(task, "queuedAt", queuedAt);
    return task;
  }
}

