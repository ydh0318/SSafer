package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.agent.ws.AgentTaskAvailableNotificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.api.dto.LocalAgentScanRequest;
import com.ssafer.scan.api.dto.LocalAgentScanRequestResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class LocalAgentScanRequestServiceTest {

  private ProjectAuthorizationService projectAuthorizationService;
  private AgentRepository agentRepository;
  private ScanRepository scanRepository;
  private AgentTaskRepository agentTaskRepository;
  private AgentTaskAvailableNotificationService notificationService;
  private LocalAgentScanRequestService service;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    agentRepository = Mockito.mock(AgentRepository.class);
    scanRepository = Mockito.mock(ScanRepository.class);
    agentTaskRepository = Mockito.mock(AgentTaskRepository.class);
    notificationService = Mockito.mock(AgentTaskAvailableNotificationService.class);
    objectMapper = new ObjectMapper();

    PlatformTransactionManager transactionManager = Mockito.mock(PlatformTransactionManager.class);
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());

    service = new LocalAgentScanRequestService(
        projectAuthorizationService,
        agentRepository,
        scanRepository,
        agentTaskRepository,
        notificationService,
        objectMapper,
        transactionManager
    );
    ReflectionTestUtils.setField(service, "rawResultBucket", "ssafer-test");
  }

  @Test
  void requestScanCreatesRequestedScanAndPendingScanRequestTask() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(10L, 1L);
    Agent agent = agent(100L, project, AgentStatus.ONLINE);

    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.of(agent));
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 1000L);
      return scan;
    });
    given(agentTaskRepository.save(any(AgentTask.class))).willAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 3000L);
      return task;
    });
    given(notificationService.notifyTaskAvailable(any(AgentTaskAvailableRequestedEvent.class))).willReturn(true);

    LocalAgentScanRequestResponseData response = service.requestScan(
        10L,
        actor,
        new LocalAgentScanRequest(" /opt/app ", "운영 서버 점검", null, null)
    );

    assertThat(response.scanId()).isEqualTo(1000L);
    assertThat(response.agentTaskId()).isEqualTo(3000L);
    assertThat(response.status()).isEqualTo(ScanStatus.REQUESTED);
    assertThat(response.agentTaskStatus()).isEqualTo(AgentTaskStatus.PENDING);
    assertThat(response.notificationSent()).isTrue();

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    verify(scanRepository).save(scanCaptor.capture());
    assertThat(scanCaptor.getValue().getAgentId()).isEqualTo(100L);
    assertThat(scanCaptor.getValue().getScanMode()).isEqualTo(com.ssafer.scan.domain.enums.ScanMode.AGENT);
    assertThat(scanCaptor.getValue().getScanType()).isEqualTo(ScanType.PROJECT_FILE);
    assertThat(scanCaptor.getValue().getStatus()).isEqualTo(ScanStatus.REQUESTED);
    JsonNode targetSnapshot = objectMapper.readTree(scanCaptor.getValue().getTargetSnapshotJson());
    assertThat(targetSnapshot.get("scanType").asText()).isEqualTo("PROJECT_FILE");

    ArgumentCaptor<AgentTask> taskCaptor = ArgumentCaptor.forClass(AgentTask.class);
    verify(agentTaskRepository).save(taskCaptor.capture());
    AgentTask task = taskCaptor.getValue();
    assertThat(task.getTaskType()).isEqualTo(AgentTaskType.SCAN_REQUEST);
    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.PENDING);

    JsonNode payload = objectMapper.readTree(task.getPayloadJson());
    assertThat(payload.get("targetPath").asText()).isEqualTo("/opt/app");
    assertThat(payload.get("scanName").asText()).isEqualTo("운영 서버 점검");
    assertThat(payload.get("includeLogs").asBoolean()).isFalse();
    assertThat(payload.get("rawResultPath").asText()).startsWith("s3://ssafer-test/raw/1000/");
    assertThat(payload.has("rawUploadUrl")).isFalse();
  }

  @Test
  void requestScanWhenServerAuditScanTypeCreatesServerAuditScanSnapshot() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(10L, 1L);
    Agent agent = agent(100L, project, AgentStatus.ONLINE);

    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.of(agent));
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 1000L);
      return scan;
    });
    given(agentTaskRepository.save(any(AgentTask.class))).willAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 3000L);
      return task;
    });

    service.requestScan(
        10L,
        actor,
        new LocalAgentScanRequest("/opt/app", "server audit", ScanType.SERVER_AUDIT, true)
    );

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    verify(scanRepository).save(scanCaptor.capture());
    Scan scan = scanCaptor.getValue();
    assertThat(scan.getScanType()).isEqualTo(ScanType.SERVER_AUDIT);

    JsonNode targetSnapshot = objectMapper.readTree(scan.getTargetSnapshotJson());
    assertThat(targetSnapshot.get("scanType").asText()).isEqualTo("SERVER_AUDIT");
    assertThat(targetSnapshot.get("targetPath").asText()).isEqualTo("/opt/app");
    assertThat(targetSnapshot.get("includeLogs").asBoolean()).isTrue();
  }

  @Test
  void requestScanReturnsNotificationSentFalseWhenWebSocketNotificationFails() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(10L, 1L);
    Agent agent = agent(100L, project, AgentStatus.ONLINE);

    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.of(agent));
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 1000L);
      return scan;
    });
    given(agentTaskRepository.save(any(AgentTask.class))).willAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 3000L);
      return task;
    });
    given(notificationService.notifyTaskAvailable(any(AgentTaskAvailableRequestedEvent.class))).willReturn(false);

    LocalAgentScanRequestResponseData response = service.requestScan(
        10L,
        actor,
        new LocalAgentScanRequest("/opt/app", null, null, false)
    );

    assertThat(response.notificationSent()).isFalse();
    assertThat(response.agentTaskStatus()).isEqualTo(AgentTaskStatus.PENDING);
    verify(agentTaskRepository).save(any(AgentTask.class));
  }

  @Test
  void requestScanThrowsAgentNotFoundWhenProjectHasNoAgent() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(10L, 1L);

    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.empty());
    given(agentRepository.findFirstByProjectId(10L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.requestScan(10L, actor, new LocalAgentScanRequest("/opt/app", null, null, false)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.AGENT_NOT_FOUND);
    verify(agentTaskRepository, never()).save(any(AgentTask.class));
  }

  @Test
  void requestScanThrowsAgentOfflineWhenAgentIsNotOnline() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(10L, 1L);
    Agent agent = agent(100L, project, AgentStatus.OFFLINE);

    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findLatestByProjectIdAndStatus(10L, AgentStatus.ONLINE)).willReturn(Optional.empty());
    given(agentRepository.findFirstByProjectId(10L)).willReturn(Optional.of(agent));

    assertThatThrownBy(() -> service.requestScan(10L, actor, new LocalAgentScanRequest("/opt/app", null, null, false)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.AGENT_OFFLINE);
    verify(agentTaskRepository, never()).save(any(AgentTask.class));
  }

  private Project project(Long projectId, Long userId) {
    Project project = new Project(userId, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Agent agent(Long agentId, Project project, AgentStatus status) {
    Agent agent = new Agent(project, status);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }
}
