package com.ssafer.agent.domain.entity;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
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
@Table(name = "agent_tasks")
public class AgentTask {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "agent_id", nullable = false)
  private Agent agent;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "project_id", nullable = false)
  private Project project;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "scan_id", nullable = false)
  private Scan scan;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "finding_id")
  // SCAN_REQUEST 작업은 finding 없이 생성될 수 있고, PATCH_APPLY 작업에서 주로 사용된다.
  private ScanFinding finding;

  @Enumerated(EnumType.STRING)
  @Column(name = "task_type", nullable = false, length = 30)
  private AgentTaskType taskType;

  @Enumerated(EnumType.STRING)
  @Column(name = "task_status", nullable = false, length = 20)
  private AgentTaskStatus taskStatus;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json")
  private String payloadJson;

  @Column(name = "queued_at", nullable = false)
  private Instant queuedAt;

  @Column(name = "sent_at")
  private Instant sentAt;

  @Column(name = "acked_at")
  private Instant ackedAt;

  @Column(name = "started_at")
  private Instant startedAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  @Column(name = "failure_reason", columnDefinition = "text")
  private String failureReason;

  protected AgentTask() {
  }

  public AgentTask(
      Agent agent,
      Project project,
      Scan scan,
      ScanFinding finding,
      AgentTaskType taskType,
      AgentTaskStatus taskStatus,
      String payloadJson
  ) {
    this.agent = agent;
    this.project = project;
    this.scan = scan;
    this.finding = finding;
    this.taskType = taskType;
    this.taskStatus = taskStatus;
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

  public Agent getAgent() {
    return agent;
  }

  public Project getProject() {
    return project;
  }

  public Scan getScan() {
    return scan;
  }

  public ScanFinding getFinding() {
    return finding;
  }

  public AgentTaskType getTaskType() {
    return taskType;
  }

  public AgentTaskStatus getTaskStatus() {
    return taskStatus;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public Instant getQueuedAt() {
    return queuedAt;
  }

  public Instant getSentAt() {
    return sentAt;
  }

  public Instant getAckedAt() {
    return ackedAt;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public String getFailureReason() {
    return failureReason;
  }
}
