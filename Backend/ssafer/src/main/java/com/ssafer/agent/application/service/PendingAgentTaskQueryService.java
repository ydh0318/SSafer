package com.ssafer.agent.application.service;

import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.application.service.RawUploadUrlIssuer;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
// Local Agent가 주기적으로 호출하는 task pull 서비스다.
// WebSocket은 "새 task 있음" 알림만 담당하고, 실제 payload 전달과 SENT 전이는 이 조회 API에서 처리한다.
public class PendingAgentTaskQueryService {

  // PENDING은 아직 한 번도 agent에게 전달되지 않은 task이고,
  // SENT는 전달 직후 agent가 실행 시작 전에 종료/재연결했을 수 있는 task다.
  private static final List<AgentTaskStatus> DISPATCH_TARGET_STATUSES =
      List.of(AgentTaskStatus.PENDING, AgentTaskStatus.SENT);

  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final RawUploadUrlIssuer rawUploadUrlIssuer;
  private final ObjectMapper objectMapper;

  public PendingAgentTaskQueryService(
      AgentRepository agentRepository,
      AgentTaskRepository agentTaskRepository,
      RawUploadUrlIssuer rawUploadUrlIssuer,
      ObjectMapper objectMapper
  ) {
    this.agentRepository = agentRepository;
    this.agentTaskRepository = agentTaskRepository;
    this.rawUploadUrlIssuer = rawUploadUrlIssuer;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public List<PendingAgentTaskResponseData> getPendingTasks(Long pathAgentId, Long authenticatedAgentId) {
    // path agent 존재 여부를 먼저 확인해 NOT_FOUND와 FORBIDDEN을 명확히 구분한다.
    Agent agent = agentRepository.findById(pathAgentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    if (!agent.getId().equals(authenticatedAgentId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    Instant sentAt = Instant.now();
    return agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(agent.getId(), DISPATCH_TARGET_STATUSES)
        .stream()
        .map(task -> mapToResponseAndMarkSent(task, sentAt))
        .toList();
  }

  private PendingAgentTaskResponseData mapToResponseAndMarkSent(AgentTask task, Instant sentAt) {
    // PENDING task는 이번 조회가 실제 전달 시점이므로 SENT로 전이한다.
    // 이미 SENT인 task는 agent 재연결/재조회 상황으로 보고 상태를 유지한 채 다시 내려준다.
    if (task.getTaskStatus() == AgentTaskStatus.PENDING) {
      task.markSent(sentAt);
    }
    return new PendingAgentTaskResponseData(
        task.getId(),
        task.getTaskType(),
        task.getTaskStatus(),
        task.getProject().getId(),
        task.getScan().getId(),
        task.getFinding() == null ? null : task.getFinding().getId(),
        parsePayload(task),
        task.getQueuedAt()
    );
  }

  private JsonNode parsePayload(AgentTask task) {
    String payloadJson = task.getPayloadJson();
    if (payloadJson == null || payloadJson.isBlank()) {
      return null;
    }
    try {
      JsonNode payload = objectMapper.readTree(payloadJson);
      if (task.getTaskType() == AgentTaskType.SCAN_REQUEST) {
        // rawUploadUrl은 presigned URL이라 만료된다.
        // DB에 오래 저장하지 않고 agent가 task를 가져가는 바로 이 시점에 새로 발급해 붙인다.
        return appendFreshRawUploadUrl(payload);
      }
      return payload;
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      // payload가 깨져 있어도 조회 API 자체는 안정적으로 응답하도록 null 처리한다.
      return null;
    }
  }

  private JsonNode appendFreshRawUploadUrl(JsonNode payload) {
    // 과거 task나 다른 taskType처럼 rawResultPath가 없는 payload는 그대로 내려준다.
    if (!(payload instanceof ObjectNode objectNode)
        || !payload.has("rawResultPath")
        || payload.get("rawResultPath").isNull()
        || payload.get("rawResultPath").asText().isBlank()) {
      return payload;
    }

    String objectKey = extractObjectKey(payload.get("rawResultPath").asText());
    objectNode.put("rawUploadUrl", rawUploadUrlIssuer.issuePutUrl(objectKey));
    return objectNode;
  }

  private String extractObjectKey(String rawResultPath) {
    try {
      // rawResultPath는 scan row와 task payload에 s3://bucket/key 형태로 저장한다.
      // PUT presigned URL 발급에는 bucket이 아니라 object key만 필요하므로 key만 분리한다.
      URI uri = URI.create(rawResultPath);
      if (!"s3".equalsIgnoreCase(uri.getScheme())) {
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
      }
      String bucket = uri.getHost();
      String key = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
      if (bucket == null || bucket.isBlank() || key.isBlank()) {
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
      }
      return key;
    } catch (IllegalArgumentException ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
