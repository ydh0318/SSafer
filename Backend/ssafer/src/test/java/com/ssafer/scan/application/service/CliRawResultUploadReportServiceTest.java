package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class CliRawResultUploadReportServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private AgentRepository agentRepository;
  @Mock
  private AgentTaskRepository agentTaskRepository;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private RawResultObjectVerifier rawResultObjectVerifier;
  @Mock
  private AgentTaskPublisher agentTaskPublisher;
  @Mock
  private ObjectMapper objectMapper;

  @InjectMocks
  private CliRawResultUploadReportService service;

  @Test
  void reportSuccessCreatesTaskPublishesAndQueuesScan() throws Exception {
    Scan scan = createScan(ScanStatus.REQUESTED);
    Agent agent = createAgent(200L, 101L);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.of(agent));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(agentTaskRepository.save(any(AgentTask.class))).thenAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 3001L);
      ReflectionTestUtils.setField(task, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:00Z"));
      return task;
    });

    CliRawResultUploadReportResponseData response = service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(
            "ssafer-cli",
            "1.4.0",
            152,
            "sha256:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
        )
    );

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.status()).isEqualTo(ScanStatus.QUEUED);
    assertThat(response.resultCount()).isEqualTo(152);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.QUEUED);
    assertThat(scan.getProgressStep()).isEqualTo("WAITING_FOR_WORKER");
    assertThat(scan.getRawResultJson()).isEqualTo("{\"ok\":true}");

    ArgumentCaptor<AgentTask> taskCaptor = ArgumentCaptor.forClass(AgentTask.class);
    verify(agentTaskRepository).save(taskCaptor.capture());
    AgentTask savedTask = taskCaptor.getValue();
    assertThat(savedTask.getTaskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(savedTask.getPayloadJson()).isEqualTo("{\"ok\":true}");

    ArgumentCaptor<ScanRequestTaskMessage> messageCaptor = ArgumentCaptor.forClass(ScanRequestTaskMessage.class);
    verify(agentTaskPublisher).publishScanRequest(messageCaptor.capture());
    ScanRequestTaskMessage message = messageCaptor.getValue();
    assertThat(message.taskId()).isEqualTo(3001L);
    assertThat(message.messageType()).isEqualTo("SCAN_REQUEST");
    assertThat(message.messageVersion()).isEqualTo(1);
    assertThat(message.taskType()).isEqualTo(com.ssafer.agent.domain.enums.AgentTaskType.SCAN_REQUEST);
    assertThat(message.agentId()).isEqualTo(200L);
    assertThat(message.projectId()).isEqualTo(101L);
    assertThat(message.scanId()).isEqualTo(1001L);
    assertThat(message.rawResultPath()).isEqualTo("s3://ssafer/raw/1001/scan_result.json");
    assertThat(message.resultCount()).isEqualTo(152);
    assertThat(message.payloadHash())
        .isEqualTo("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assertThat(message.queuedAt()).isEqualTo(java.time.Instant.parse("2026-05-06T04:00:00Z"));
  }

  @Test
  void reportWhenAgentMissingThrowsNotFound() {
    Scan scan = createScan(ScanStatus.REQUESTED);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void reportWhenPublishFailsThrowsInternalServerError() throws Exception {
    Scan scan = createScan(ScanStatus.REQUESTED);
    Agent agent = createAgent(200L, 101L);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.of(agent));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(agentTaskRepository.save(any(AgentTask.class))).thenAnswer(invocation -> {
      AgentTask task = invocation.getArgument(0);
      ReflectionTestUtils.setField(task, "id", 3001L);
      ReflectionTestUtils.setField(task, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:00Z"));
      return task;
    });
    doThrow(new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR))
        .when(agentTaskPublisher)
        .publishScanRequest(any(ScanRequestTaskMessage.class));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  @Test
  void reportWithInvalidPayloadHashThrowsInvalidPayloadHash() {
    Scan scan = createScan(ScanStatus.REQUESTED);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, "sha256:abc123")
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PAYLOAD_HASH);
  }

  @ParameterizedTest
  @EnumSource(value = ScanStatus.class, names = {"RAW_UPLOADED", "QUEUED", "RUNNING", "DONE"})
  void reportWhenStatusIsAlreadyAcceptedFlowThrowsDuplicate(ScanStatus status) {
    Scan scan = createScan(status);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(null, null, null, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
  }

  @ParameterizedTest
  @EnumSource(value = ScanStatus.class, names = {"FAILED", "CANCELED"})
  void reportWhenStatusIsNotAcceptableThrowsConflict(ScanStatus status) {
    Scan scan = createScan(status);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(null, null, null, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_STATUS_CONFLICT);
  }

  @Test
  void reportWhenRawResultObjectMissingThrowsNotFound() {
    Scan scan = createScan(ScanStatus.REQUESTED);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(false);

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.RAW_RESULT_NOT_FOUND);
  }

  @Test
  void reportWhenActorHasNoProjectPermissionThrowsForbidden() {
    Scan scan = createScan(ScanStatus.REQUESTED);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(999L));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(999L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void reportWhenProjectIsInactiveOrMissingThrowsNotFound() {
    Scan scan = createScan(ScanStatus.REQUESTED);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.NOT_FOUND))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  private Scan createScan(ScanStatus status) {
    return Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
  }

  private Agent createAgent(Long agentId, Long projectId) {
    Project project = new Project(1L, null, "test-project", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);

    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }
}
