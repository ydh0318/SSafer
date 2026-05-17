package com.ssafer.worker.domain.entity;

import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "worker_jobs")
public class WorkerJob {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "project_id", nullable = false)
  private Project project;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "scan_id", nullable = false)
  private Scan scan;

  @Enumerated(EnumType.STRING)
  @Column(name = "job_type", nullable = false, length = 40)
  private WorkerJobType jobType;

  @Enumerated(EnumType.STRING)
  @Column(name = "job_status", nullable = false, length = 20)
  private WorkerJobStatus jobStatus;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json")
  private String payloadJson;

  @Column(name = "queued_at", nullable = false)
  private Instant queuedAt;

  @Column(name = "published_at")
  private Instant publishedAt;

  @Column(name = "publish_attempt_count", nullable = false)
  private int publishAttemptCount;

  @Column(name = "last_publish_attempt_at")
  private Instant lastPublishAttemptAt;

  @Column(name = "started_at")
  private Instant startedAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  @Column(name = "failure_reason", columnDefinition = "text")
  private String failureReason;

  protected WorkerJob() {
  }

  public WorkerJob(
      Project project,
      Scan scan,
      WorkerJobType jobType,
      WorkerJobStatus jobStatus,
      String payloadJson
  ) {
    this.project = project;
    this.scan = scan;
    this.jobType = jobType;
    this.jobStatus = jobStatus;
    this.payloadJson = payloadJson;
  }

  @PrePersist
  void onCreate() {
    if (queuedAt == null) {
      queuedAt = Instant.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Project getProject() {
    return project;
  }

  public Scan getScan() {
    return scan;
  }

  public WorkerJobType getJobType() {
    return jobType;
  }

  public WorkerJobStatus getJobStatus() {
    return jobStatus;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public Instant getQueuedAt() {
    return queuedAt;
  }

  public Instant getPublishedAt() {
    return publishedAt;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public int getPublishAttemptCount() {
    return publishAttemptCount;
  }

  public Instant getLastPublishAttemptAt() {
    return lastPublishAttemptAt;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public String getFailureReason() {
    return failureReason;
  }

  public void updatePayloadJson(String payloadJson) {
    this.payloadJson = payloadJson;
  }

  public void markPublished(Instant now) {
    transitionTo(WorkerJobStatus.PUBLISHED);
    if (this.publishedAt == null) {
      this.publishedAt = now;
    }
    this.lastPublishAttemptAt = now;
    this.publishAttemptCount += 1;
    this.failureReason = null;
  }

  public void markRunning(Instant now) {
    transitionTo(WorkerJobStatus.RUNNING);
    this.startedAt = now;
    this.failureReason = null;
  }

  public void markSucceeded(Instant now) {
    transitionTo(WorkerJobStatus.SUCCEEDED);
    this.completedAt = now;
    this.failureReason = null;
  }

  public void markFailed(Instant now, String failureReason) {
    transitionTo(WorkerJobStatus.FAILED);
    this.completedAt = now;
    this.failureReason = failureReason;
  }

  public void markCanceled(Instant now, String failureReason) {
    transitionTo(WorkerJobStatus.CANCELED);
    this.completedAt = now;
    this.failureReason = failureReason;
  }

  private void transitionTo(WorkerJobStatus nextStatus) {
    this.jobStatus.assertTransitionAllowed(nextStatus);
    this.jobStatus = nextStatus;
  }
}
