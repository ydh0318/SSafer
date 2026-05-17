package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import com.ssafer.worker.domain.repository.WorkerJobRepository;

@Component
@Slf4j
public class UploadScanAnalysisTaskDispatcher {
  private static final String QUEUED_PROGRESS_STEP = "UPLOAD_ANALYSIS_QUEUED";
  private static final String QUEUE_PUBLISH_FAILED_PROGRESS_STEP = "UPLOAD_ANALYSIS_QUEUE_PUBLISH_FAILED";

  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final AgentRepository agentRepository;
  private final WorkerJobRepository workerJobRepository;
  private final AgentTaskPublisher agentTaskPublisher;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;

  public UploadScanAnalysisTaskDispatcher(
      ProjectRepository projectRepository,
      ScanRepository scanRepository,
      AgentRepository agentRepository,
      WorkerJobRepository workerJobRepository,
      AgentTaskPublisher agentTaskPublisher,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager
  ) {
    this.projectRepository = projectRepository;
    this.scanRepository = scanRepository;
    this.agentRepository = agentRepository;
    this.workerJobRepository = workerJobRepository;
    this.agentTaskPublisher = agentTaskPublisher;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public boolean dispatch(
      Long scanId,
      Long projectId,
      String rawResultPath,
      Integer resultCount,
      String tool,
      String toolVersion,
      String payloadHash
  ) {
    PreparedUploadDispatch prepared = transactionTemplate.execute(status -> prepareDispatch(
        scanId,
        projectId,
        rawResultPath,
        resultCount,
        tool,
        toolVersion,
        payloadHash
    ));
    if (prepared == null) {
      return false;
    }

    try {
      agentTaskPublisher.publishScanRequest(prepared.message());
    } catch (RuntimeException ex) {
      transactionTemplate.executeWithoutResult(status -> compensatePublishFailure(prepared.workerJobId(), prepared.scanId()));
      throw new UploadScanQueuePublishException("Failed to publish upload scan task", ex);
    }
    return true;
  }

  private PreparedUploadDispatch prepareDispatch(
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
      return null;
    }

    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElse(null);
    if (scan == null || !projectId.equals(scan.getProjectId())) {
      log.info(
          "Skip upload scan dispatch because scan is deleted or missing: scanId={}, projectId={}",
          scanId,
          projectId
      );
      return null;
    }
    if (scan.getStatus() != ScanStatus.RAW_UPLOADED) {
      log.info(
          "Skip upload scan dispatch because scan status is not RAW_UPLOADED: scanId={}, projectId={}, status={}",
          scanId,
          projectId,
          scan.getStatus()
      );
      return null;
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
      workerJob.markPublished(Instant.now());
      scan.markQueued(
          QUEUED_PROGRESS_STEP,
          scan.getRawResultJson(),
          scan.getStartedAt() != null ? scan.getStartedAt() : LocalDateTime.now(),
          LocalDateTime.now()
      );
      return new PreparedUploadDispatch(workerJob.getId(), scan.getId(), message);
    } catch (Exception ex) {
      throw new UploadScanQueuePublishException("Failed to prepare upload scan task", ex);
    }
  }

  private void compensatePublishFailure(Long workerJobId, Long scanId) {
    LocalDateTime now = LocalDateTime.now();
    WorkerJob workerJob = workerJobRepository.findByIdAndScanIdForUpdate(workerJobId, scanId)
        .orElse(null);
    if (workerJob != null && !workerJob.getJobStatus().isTerminal()) {
      workerJob.markCanceled(
          now.atZone(java.time.ZoneId.systemDefault()).toInstant(),
          ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name()
      );
    }

    Scan scan = scanRepository.findByIdForUpdate(scanId).orElse(null);
    if (scan != null && scan.getStatus() == ScanStatus.QUEUED) {
      scan.updateRawResult(
          ScanStatus.RAW_UPLOADED,
          QUEUE_PUBLISH_FAILED_PROGRESS_STEP,
          ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name(),
          scan.getRawResultJson(),
          scan.getRawResultPath(),
          scan.getStartedAt() != null ? scan.getStartedAt() : now,
          null,
          now
      );
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

  private record PreparedUploadDispatch(
      Long workerJobId,
      Long scanId,
      ScanRequestTaskMessage message
  ) {
  }
}
