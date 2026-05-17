package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.repository.WorkerJobRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
public class WorkerJobRepublishScheduler {

  private static final String RETRY_EXHAUSTED_PROGRESS_STEP = "UPLOAD_ANALYSIS_QUEUE_RETRY_EXHAUSTED";

  private final WorkerJobRepository workerJobRepository;
  private final ScanRepository scanRepository;
  private final AgentTaskPublisher agentTaskPublisher;
  private final ApplicationEventPublisher applicationEventPublisher;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;
  private final int maxAttempts;
  private final int batchSize;
  private final long staleSeconds;

  public WorkerJobRepublishScheduler(
      WorkerJobRepository workerJobRepository,
      ScanRepository scanRepository,
      AgentTaskPublisher agentTaskPublisher,
      ApplicationEventPublisher applicationEventPublisher,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager,
      @Value("${ssafer.worker-job.republish.max-attempts:3}") int maxAttempts,
      @Value("${ssafer.worker-job.republish.batch-size:20}") int batchSize,
      @Value("${ssafer.worker-job.republish.stale-seconds:120}") long staleSeconds
  ) {
    this.workerJobRepository = workerJobRepository;
    this.scanRepository = scanRepository;
    this.agentTaskPublisher = agentTaskPublisher;
    this.applicationEventPublisher = applicationEventPublisher;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.maxAttempts = maxAttempts;
    this.batchSize = batchSize;
    this.staleSeconds = staleSeconds;
  }

  @Scheduled(fixedDelayString = "#{${ssafer.worker-job.republish.fixed-delay-seconds:60} * 1000}")
  public void republishStaleJobs() {
    Instant cutoff = Instant.now().minusSeconds(staleSeconds);
    List<WorkerJob> candidates = workerJobRepository.findByJobStatusInOrderByQueuedAtAsc(List.of(WorkerJobStatus.PUBLISHED));
    int processed = 0;

    for (WorkerJob candidate : candidates) {
      if (processed >= batchSize) {
        return;
      }
      if (!isStale(candidate, cutoff)) {
        continue;
      }

      PreparedRepublish prepared = transactionTemplate.execute(status -> prepareRepublish(candidate.getId(), cutoff));
      if (prepared == null) {
        continue;
      }

      try {
        agentTaskPublisher.publishScanRequest(prepared.message());
        processed += 1;
      } catch (RuntimeException ex) {
        log.warn(
            "Worker job republish failed: workerJobId={}, scanId={}, attempt={}",
            prepared.workerJobId(),
            prepared.scanId(),
            prepared.publishAttemptCount(),
            ex
        );
      }
    }
  }

  private PreparedRepublish prepareRepublish(Long workerJobId, Instant cutoff) {
    WorkerJob workerJob = workerJobRepository.findByIdForUpdate(workerJobId).orElse(null);
    if (workerJob == null || workerJob.getJobStatus() != WorkerJobStatus.PUBLISHED) {
      return null;
    }
    if (!isStale(workerJob, cutoff)) {
      return null;
    }

    Scan scan = scanRepository.findByIdForUpdate(workerJob.getScan().getId()).orElse(null);
    if (scan == null) {
      workerJob.markCanceled(Instant.now(), "SCAN_NOT_FOUND");
      return null;
    }
    if (scan.getStatus() != ScanStatus.QUEUED) {
      workerJob.markCanceled(Instant.now(), "SCAN_NOT_QUEUED");
      return null;
    }
    if (workerJob.getPublishAttemptCount() >= maxAttempts) {
      markRetryExhausted(workerJob, scan, LocalDateTime.now());
      return null;
    }
    if (workerJob.getPayloadJson() == null || workerJob.getPayloadJson().isBlank()) {
      markRetryExhausted(workerJob, scan, LocalDateTime.now());
      return null;
    }

    try {
      ScanRequestTaskMessage message = objectMapper.readValue(workerJob.getPayloadJson(), ScanRequestTaskMessage.class);
      workerJob.markPublished(Instant.now());
      return new PreparedRepublish(workerJob.getId(), scan.getId(), workerJob.getPublishAttemptCount(), message);
    } catch (Exception ex) {
      log.error("Failed to deserialize worker job payload for republish: workerJobId={}", workerJob.getId(), ex);
      markRetryExhausted(workerJob, scan, LocalDateTime.now());
      return null;
    }
  }

  private void markRetryExhausted(WorkerJob workerJob, Scan scan, LocalDateTime now) {
    if (!workerJob.getJobStatus().isTerminal()) {
      workerJob.markFailed(toInstant(now), ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name());
    }
    if (!scan.getStatus().isTerminal()) {
      scan.markAnalysisFailed(
          RETRY_EXHAUSTED_PROGRESS_STEP,
          ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name(),
          scan.getStartedAt() != null ? scan.getStartedAt() : now,
          now,
          now
      );
      applicationEventPublisher.publishEvent(new ScanStatusSsePublishRequestedEvent(scan.getId(), ScanStatus.FAILED));
    }
  }

  private boolean isStale(WorkerJob workerJob, Instant cutoff) {
    Instant lastAttemptAt = workerJob.getLastPublishAttemptAt();
    return lastAttemptAt != null && !lastAttemptAt.isAfter(cutoff);
  }

  private Instant toInstant(LocalDateTime value) {
    return value.atZone(ZoneId.systemDefault()).toInstant();
  }

  private record PreparedRepublish(
      Long workerJobId,
      Long scanId,
      int publishAttemptCount,
      ScanRequestTaskMessage message
  ) {
  }
}
