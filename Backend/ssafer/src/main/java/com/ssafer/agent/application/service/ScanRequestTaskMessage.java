package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.worker.domain.entity.WorkerJob;
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
    ScanType scanType,
    String rawResultPath,
    Integer resultCount,
    String tool,
    String toolVersion,
    String payloadHash,
    Instant queuedAt
) {

  public static final String MESSAGE_TYPE = "SCAN_REQUEST";
  public static final int MESSAGE_VERSION = 2;

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
        task.getScan().getScanType(),
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash,
        task.getQueuedAt()
    );
  }

  public static ScanRequestTaskMessage ofUploadAnalysis(
      WorkerJob job,
      Long agentId,
      String rawResultPath,
      Integer resultCount,
      String tool,
      String toolVersion,
      String payloadHash
  ) {
    // worker_jobs로 분리했더라도 현재 RabbitMQ consumer는 SCAN_REQUEST payload를 기대한다.
    // taskId에는 worker_job.id를 싣고, agentId는 기존 계약 호환용으로만 유지한다.
    return new ScanRequestTaskMessage(
        MESSAGE_TYPE,
        MESSAGE_VERSION,
        AgentTaskType.SCAN_REQUEST,
        job.getId(),
        agentId,
        job.getProject().getId(),
        job.getScan().getId(),
        job.getScan().getScanType(),
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash,
        job.getQueuedAt()
    );
  }
}
