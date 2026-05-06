package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
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
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
@RequiredArgsConstructor
// 공개 CLI 완료 알림 API의 검증과 작업 발행을 담당한다.
public class CliRawResultUploadReportService {

  private static final Pattern PAYLOAD_HASH_PATTERN = Pattern.compile("^sha256:[a-fA-F0-9]{64}$");
  private static final String QUEUED_PROGRESS_STEP = "WAITING_FOR_WORKER";

  private final ScanRepository scanRepository;
  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final RawResultObjectVerifier rawResultObjectVerifier;
  private final AgentTaskPublisher agentTaskPublisher;
  private final ObjectMapper objectMapper;

  @Transactional
  public CliRawResultUploadReportResponseData report(
      Long scanId,
      AuthenticatedActor actor,
      CliRawResultUploadReportRequest request
  ) {
    // 동시에 같은 완료 알림이 들어와도 한 번만 처리되도록 scan row를 잠근다.
    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 권한, 입력값, 상태, S3 객체 존재 여부를 순서대로 검증한다.
    // 권한 검증과 동시에 Project 엔티티를 확보해 fallback agent 생성에 재사용한다.
    Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    validatePayloadHash(request.payloadHash());
    validateScanStatus(scan.getStatus());
    validateRawObjectExists(scan.getRawResultPath());

    // 프로젝트에 agent가 없으면 placeholder(OFFLINE) agent를 만들어
    // 기존 Rabbit 메시지 계약(taskId/agentId 포함)을 유지한다.
    Agent agent = loadOrCreateDispatchAgent(project);
    LocalDateTime now = LocalDateTime.now();

    AgentTask agentTask = agentTaskRepository.save(new AgentTask(
        agent,
        agent.getProject(),
        scan,
        null,
        AgentTaskType.SCAN_REQUEST,
        AgentTaskStatus.PENDING,
        null
    ));

    String rawResultMetadataJson = buildRawResultMetadataJson(request);
    ScanRequestTaskMessage message = ScanRequestTaskMessage.of(
        agentTask,
        scan.getRawResultPath(),
        request.resultCount(),
        normalizeBlank(request.tool()),
        normalizeBlank(request.toolVersion()),
        normalizePayloadHash(request.payloadHash())
    );
    String taskPayloadJson = buildTaskPayloadJson(message);

    // taskId가 생성된 뒤 최종 payload를 저장하고, 같은 payload를 RabbitMQ로 발행한다.
    agentTask.updatePayloadJson(taskPayloadJson);
    agentTaskPublisher.publishScanRequest(message);
    agentTask.markSent(Instant.now());

    scan.markQueued(
        QUEUED_PROGRESS_STEP,
        rawResultMetadataJson,
        scan.getStartedAt() != null ? scan.getStartedAt() : now,
        now
    );

    log.info(
        "CLI analysis completion accepted and queued: scanId={}, taskId={}, agentId={}, actorType={}, actorUserId={}, status={}",
        scan.getId(),
        agentTask.getId(),
        agent.getId(),
        actor.actorType(),
        actor.userId(),
        scan.getStatus()
    );

    return new CliRawResultUploadReportResponseData(scan.getId(), scan.getStatus(), request.resultCount());
  }

  private Agent loadOrCreateDispatchAgent(Project project) {
    // CLI raw-results callback은 agent 사전 등록이 없어도 처리되어야 하므로
    // project 기준 agent가 없으면 OFFLINE placeholder를 즉시 생성한다.
    // 현재는 프로젝트별 대표 agent 1대를 선택해 작업을 발행한다.
    return agentRepository.findFirstByProjectId(project.getId())
        .orElseGet(() -> agentRepository.save(new Agent(project, com.ssafer.agent.domain.enums.AgentStatus.OFFLINE)));
  }

  private void validatePayloadHash(String payloadHash) {
    if (!hasText(payloadHash)) {
      return;
    }
    if (!PAYLOAD_HASH_PATTERN.matcher(payloadHash).matches()) {
      log.warn("Invalid payloadHash format on CLI analysis completion: payloadHash={}", payloadHash);
      throw new BusinessException(ErrorCode.INVALID_PAYLOAD_HASH);
    }
  }

  private void validateScanStatus(ScanStatus status) {
    switch (status) {
      case REQUESTED:
        return;
      // 이미 완료 알림을 받았거나 이후 단계로 진행된 상태다.
      case RAW_UPLOADED:
      case QUEUED:
      case RUNNING:
      case DONE:
        log.warn("Duplicate CLI analysis completion blocked: scanStatus={}", status);
        throw new BusinessException(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
      // 아직 결과를 받지 않았더라도 현재 정책상 완료 알림을 받을 수 없는 상태다.
      case FAILED:
      case CANCELED:
      default:
        log.warn("CLI analysis completion rejected by scan status policy: scanStatus={}", status);
        throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
  }

  private void validateRawObjectExists(String rawResultPath) {
    if (!hasText(rawResultPath) || !rawResultObjectVerifier.exists(rawResultPath)) {
      log.warn("CLI analysis completion rejected because raw object was not found: rawResultPath={}", rawResultPath);
      throw new BusinessException(ErrorCode.RAW_RESULT_NOT_FOUND);
    }
  }

  private String buildRawResultMetadataJson(CliRawResultUploadReportRequest request) {
    try {
      return objectMapper.writeValueAsString(new RawResultMetadata(
          normalizeBlank(request.tool()),
          normalizeBlank(request.toolVersion()),
          request.resultCount(),
          normalizePayloadHash(request.payloadHash())
      ));
    } catch (Exception ex) {
      log.error("Failed to serialize raw_result_json metadata", ex);
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private String buildTaskPayloadJson(ScanRequestTaskMessage message) {
    try {
      return objectMapper.writeValueAsString(message);
    } catch (Exception ex) {
      log.error("Failed to serialize agent task payload: taskId={}", message.taskId(), ex);
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private String normalizePayloadHash(String payloadHash) {
    if (!hasText(payloadHash)) {
      return null;
    }
    return payloadHash.toLowerCase(Locale.ROOT);
  }

  private String normalizeBlank(String value) {
    return hasText(value) ? value : null;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private record RawResultMetadata(
      String tool,
      String toolVersion,
      Integer resultCount,
      String payloadHash
  ) {
  }
}
