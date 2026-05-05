package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskType;
import java.time.Instant;

// 워커가 consume 하는 scan 요청 메시지 규격이다.
// messageType, messageVersion, taskType을 고정해 두고 이후 필드 확장은 버전으로 관리한다.
public record ScanRequestTaskMessage(
    String messageType,
    int messageVersion,
    AgentTaskType taskType,
    Long taskId,
    Long agentId,
    Long projectId,
    Long scanId,
    String rawResultPath,
    Integer resultCount,
    String tool,
    String toolVersion,
    String payloadHash,
    Instant queuedAt
) {

  public static final String MESSAGE_TYPE = "SCAN_REQUEST";
  public static final int MESSAGE_VERSION = 1;

  public static ScanRequestTaskMessage of(
      AgentTask task,
      String rawResultPath,
      Integer resultCount,
      String tool,
      String toolVersion,
      String payloadHash
  ) {
    return new ScanRequestTaskMessage(
        MESSAGE_TYPE,
        MESSAGE_VERSION,
        task.getTaskType(),
        task.getId(),
        task.getAgent().getId(),
        task.getProject().getId(),
        task.getScan().getId(),
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash,
        task.getQueuedAt()
    );
  }
}
