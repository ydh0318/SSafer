package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import com.ssafer.worker.domain.repository.WorkerJobRepository;

@Component
@RequiredArgsConstructor
@Slf4j
public class UploadScanAnalysisTaskDispatcher {

  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final AgentRepository agentRepository;
  private final WorkerJobRepository workerJobRepository;
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
    Project project = projectRepository.findByIdAndDeletedAtIsNull(projectId)
        .orElse(null);
    if (project == null) {
      log.info(
          "Skip upload scan dispatch because project is deleted or missing: projectId={}, scanId={}",
          projectId,
          scanId
      );
      return;
    }

    Scan scan = scanRepository.findByIdAndDeletedAtIsNull(scanId)
        .orElse(null);
    if (scan == null) {
      log.info(
          "Skip upload scan dispatch because scan is deleted or missing: scanId={}, projectId={}",
          scanId,
          projectId
      );
      return;
    }

    Agent agent = loadOrCreateDispatchAgent(project);
    // 업로드 분석 요청은 Local Agent polling 대상이 아니므로 worker_jobs에만 적재한다.
    WorkerJob workerJob = workerJobRepository.save(new WorkerJob(
        project,
        scan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PENDING,
        null
    ));

    // worker consumer 계약은 유지하고, 내부 추적용 taskId만 worker_job.id로 전환한다.
    ScanRequestTaskMessage message = ScanRequestTaskMessage.ofUploadAnalysis(
        workerJob,
        agent.getId(),
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash
    );

    try {
      String payloadJson = objectMapper.writeValueAsString(message);
      workerJob.updatePayloadJson(payloadJson);
      agentTaskPublisher.publishScanRequest(message);
      workerJob.markPublished(Instant.now());
    } catch (Exception ex) {
      throw new UploadScanQueuePublishException("Failed to publish upload scan task", ex);
    }
  }

  private Agent loadOrCreateDispatchAgent(Project project) {
    return agentRepository.findFirstByProjectId(project.getId())
        .orElseGet(() -> agentRepository.save(new Agent(
            project,
            AgentStatus.OFFLINE,
            true
        )));
  }
}
