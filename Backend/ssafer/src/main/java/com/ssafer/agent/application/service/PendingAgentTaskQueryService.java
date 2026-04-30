package com.ssafer.agent.application.service;

import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class PendingAgentTaskQueryService {

  private static final List<AgentTaskStatus> PENDING_STATUSES = List.of(
      AgentTaskStatus.PENDING,
      AgentTaskStatus.SENT
  );

  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final ObjectMapper objectMapper;

  public PendingAgentTaskQueryService(
      AgentRepository agentRepository,
      AgentTaskRepository agentTaskRepository,
      ObjectMapper objectMapper
  ) {
    this.agentRepository = agentRepository;
    this.agentTaskRepository = agentTaskRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public List<PendingAgentTaskResponseData> getPendingTasks(Long pathAgentId, Long authenticatedAgentId) {
    // 먼저 path agent 존재 여부를 확인해 NOT_FOUND와 FORBIDDEN을 명확히 구분한다.
    Agent agent = agentRepository.findById(pathAgentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    if (!agent.getId().equals(authenticatedAgentId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(agent.getId(), PENDING_STATUSES)
        .stream()
        .map(task -> new PendingAgentTaskResponseData(
            task.getId(),
            task.getTaskType(),
            task.getTaskStatus(),
            task.getProject().getId(),
            task.getScan().getId(),
            task.getFinding() == null ? null : task.getFinding().getId(),
            parsePayload(task.getPayloadJson()),
            task.getQueuedAt()
        ))
        .toList();
  }

  private JsonNode parsePayload(String payloadJson) {
    if (payloadJson == null || payloadJson.isBlank()) {
      return null;
    }
    try {
      return objectMapper.readTree(payloadJson);
    } catch (Exception ex) {
      // 조회 API 안정성을 위해 파싱 실패 payload는 null로 처리한다.
      return null;
    }
  }
}

