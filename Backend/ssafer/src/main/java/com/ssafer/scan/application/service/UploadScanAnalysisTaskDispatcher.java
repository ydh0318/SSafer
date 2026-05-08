package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class UploadScanAnalysisTaskDispatcher {

  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final AgentTaskPublisher agentTaskPublisher;
  private final ObjectMapper objectMapper;

  @Transactional
  public void dispatch(
      Long scanId,
      Long projectId,
      String rawResultPath,
      Integer resultCount,
      String tool,
      String toolVersion,
      String payloadHash
  ) {
    // 업로드 경로도 기존 Worker 계약을 재사용하기 위해 AgentTask를 만들고 메시지를 발행한다.
    Project project = projectRepository.findById(projectId)
        .orElseThrow(() -> new IllegalStateException("Project not found for upload scan dispatch"));
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new IllegalStateException("Scan not found for upload scan dispatch"));

    Agent agent = loadOrCreateDispatchAgent(project);
    AgentTask task = agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        null,
        AgentTaskType.SCAN_REQUEST,
        AgentTaskStatus.PENDING,
        null
    ));

    ScanRequestTaskMessage message = ScanRequestTaskMessage.of(
        task,
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash
    );

    try {
      String payloadJson = objectMapper.writeValueAsString(message);
      task.updatePayloadJson(payloadJson);
      agentTaskPublisher.publishScanRequest(message);
      task.markSent(Instant.now());
    } catch (Exception ex) {
      throw new UploadScanQueuePublishException("Failed to publish upload scan task", ex);
    }
  }

  private Agent loadOrCreateDispatchAgent(Project project) {
    // 실제 로컬 에이전트와 무관한 내부 dispatch 용도 Agent를 재사용/생성한다.
    return agentRepository.findFirstByProjectId(project.getId())
        .orElseGet(() -> agentRepository.save(new Agent(
            project,
            AgentStatus.OFFLINE,
            true
        )));
  }
}
