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
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
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
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.repository.WorkerJobRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class CliRawResultUploadReportServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private AgentRepository agentRepository;
  @Mock
  private WorkerJobRepository workerJobRepository;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private RawResultObjectVerifier rawResultObjectVerifier;
  @Mock
  private AgentTaskPublisher agentTaskPublisher;
  @Mock
  private ObjectMapper objectMapper;
  @Mock
  private PlatformTransactionManager transactionManager;

  private CliRawResultUploadReportService service;

  @BeforeEach
  void setUp() {
    service = new CliRawResultUploadReportService(
        scanRepository,
        agentRepository,
        workerJobRepository,
        projectAuthorizationService,
        rawResultObjectVerifier,
        agentTaskPublisher,
        objectMapper,
        transactionManager
    );
  }

  @Test
  void reportSuccessCreatesTaskPublishesAndQueuesScan() throws Exception {
    Scan scan = createScan(ScanStatus.REQUESTED);
    Project project = createProject(101L);
    Agent agent = createAgent(200L, 101L);
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L)))
        .thenReturn(project);
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.of(agent));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(workerJobRepository.save(any(WorkerJob.class))).thenAnswer(invocation -> {
      WorkerJob job = invocation.getArgument(0);
      ReflectionTestUtils.setField(job, "id", 3001L);
      ReflectionTestUtils.setField(job, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:00Z"));
      return job;
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

    ArgumentCaptor<WorkerJob> jobCaptor = ArgumentCaptor.forClass(WorkerJob.class);
    verify(workerJobRepository).save(jobCaptor.capture());
    WorkerJob savedJob = jobCaptor.getValue();
    assertThat(savedJob.getJobStatus()).isEqualTo(WorkerJobStatus.PUBLISHED);
    assertThat(savedJob.getPayloadJson()).isEqualTo("{\"ok\":true}");

    ArgumentCaptor<ScanRequestTaskMessage> messageCaptor = ArgumentCaptor.forClass(ScanRequestTaskMessage.class);
    verify(agentTaskPublisher).publishScanRequest(messageCaptor.capture());
    ScanRequestTaskMessage message = messageCaptor.getValue();
    assertThat(message.taskId()).isEqualTo(3001L);
    assertThat(message.messageType()).isEqualTo("SCAN_REQUEST");
    assertThat(message.messageVersion()).isEqualTo(2);
    assertThat(message.taskType()).isEqualTo(com.ssafer.agent.domain.enums.AgentTaskType.SCAN_REQUEST);
    assertThat(message.agentId()).isEqualTo(200L);
    assertThat(message.projectId()).isEqualTo(101L);
    assertThat(message.scanId()).isEqualTo(1001L);
    assertThat(message.scanType()).isEqualTo(ScanType.SERVER_AUDIT);
    assertThat(message.rawResultPath()).isEqualTo("s3://ssafer/raw/1001/scan_result.json");
    assertThat(message.resultCount()).isEqualTo(152);
    assertThat(message.payloadHash())
        .isEqualTo("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assertThat(message.queuedAt()).isEqualTo(java.time.Instant.parse("2026-05-06T04:00:00Z"));
  }

  @Test
  void reportWhenAgentMissingCreatesFallbackAgentAndContinues() throws Exception {
    // 프로젝트에 agent가 없어도 fallback agent를 생성해
    // 기존 메시지 발행 경로가 끊기지 않아야 한다.
    // 프로젝트에 Agent가 없어도 placeholder Agent를 생성하고 publish가 이어져야 한다.
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    Scan scan = createScan(ScanStatus.REQUESTED);
    Project project = createProject(101L);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L)))
        .thenReturn(project);
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.empty());
    when(agentRepository.save(any(Agent.class))).thenAnswer(invocation -> {
      Agent fallback = invocation.getArgument(0);
      ReflectionTestUtils.setField(fallback, "id", 201L);
      return fallback;
    });
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(workerJobRepository.save(any(WorkerJob.class))).thenAnswer(invocation -> {
      WorkerJob job = invocation.getArgument(0);
      ReflectionTestUtils.setField(job, "id", 3002L);
      ReflectionTestUtils.setField(job, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:01Z"));
      return job;
    });

    CliRawResultUploadReportResponseData response = service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    );

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.status()).isEqualTo(ScanStatus.QUEUED);
    ArgumentCaptor<Agent> fallbackCaptor = ArgumentCaptor.forClass(Agent.class);
    verify(agentRepository).save(fallbackCaptor.capture());
    assertThat(fallbackCaptor.getValue().isPlaceholder()).isTrue();
    verify(agentTaskPublisher).publishScanRequest(any(ScanRequestTaskMessage.class));
  }

  @Test
  void reportWhenPublishFailsThrowsInternalServerError() throws Exception {
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    Scan scan = createScan(ScanStatus.REQUESTED);
    Project project = createProject(101L);
    Agent agent = createAgent(200L, 101L);
    WorkerJob[] savedJobHolder = new WorkerJob[1];
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L)))
        .thenReturn(project);
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.of(agent));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(workerJobRepository.save(any(WorkerJob.class))).thenAnswer(invocation -> {
      WorkerJob job = invocation.getArgument(0);
      ReflectionTestUtils.setField(job, "id", 3001L);
      ReflectionTestUtils.setField(job, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:00Z"));
      savedJobHolder[0] = job;
      return job;
    });
    when(workerJobRepository.findByIdAndScanIdForUpdate(3001L, 1001L)).thenAnswer(invocation -> Optional.of(savedJobHolder[0]));
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

    ArgumentCaptor<WorkerJob> jobCaptor = ArgumentCaptor.forClass(WorkerJob.class);
    verify(workerJobRepository).save(jobCaptor.capture());
    WorkerJob savedJob = jobCaptor.getValue();
    assertThat(savedJob.getJobStatus()).isEqualTo(WorkerJobStatus.CANCELED);
    assertThat(savedJob.getFailureReason()).isEqualTo("ANALYSIS_QUEUE_PUBLISH_FAILED");
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(scan.getFailureReason()).isEqualTo("ANALYSIS_QUEUE_PUBLISH_FAILED");
    assertThat(scan.getProgressStep()).isEqualTo("CLI_ANALYSIS_QUEUE_PUBLISH_FAILED");
  }

  @Test
  void reportWithInvalidPayloadHashThrowsInvalidPayloadHash() {
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
  @EnumSource(value = ScanStatus.class, names = {"QUEUED", "RUNNING", "DONE"})
  void reportWhenStatusIsAlreadyAcceptedFlowThrowsDuplicate(ScanStatus status) {
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
        .scanType(ScanType.SERVER_AUDIT)
        .status(status)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
  }

  @Test
  void reportWhenStatusIsRawUploadedAllowsRetryAndQueuesAgain() throws Exception {
    when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());

    Scan scan = createScan(ScanStatus.RAW_UPLOADED);
    Project project = createProject(101L);
    Agent agent = createAgent(200L, 101L);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L)))
        .thenReturn(project);
    when(agentRepository.findFirstByProjectId(101L)).thenReturn(Optional.of(agent));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");
    when(workerJobRepository.save(any(WorkerJob.class))).thenAnswer(invocation -> {
      WorkerJob job = invocation.getArgument(0);
      ReflectionTestUtils.setField(job, "id", 3003L);
      ReflectionTestUtils.setField(job, "queuedAt", java.time.Instant.parse("2026-05-06T04:00:02Z"));
      return job;
    });

    CliRawResultUploadReportResponseData response = service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 10, null)
    );

    assertThat(response.status()).isEqualTo(ScanStatus.QUEUED);
    verify(agentTaskPublisher).publishScanRequest(any(ScanRequestTaskMessage.class));
  }

  private Agent createAgent(Long agentId, Long projectId) {
    Project project = createProject(projectId);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }

  private Project createProject(Long projectId) {
    Project project = new Project(1L, null, "test-project", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }
}
