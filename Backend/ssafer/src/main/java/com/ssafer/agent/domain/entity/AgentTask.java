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

  // 작업 메시지 규격이 확정된 뒤 taskId 포함 payload를 다시 기록할 때 사용한다.
  public void updatePayloadJson(String payloadJson) {
    this.payloadJson = payloadJson;
  }

  // RabbitMQ 발행 완료 이후 미전송 상태를 SENT로 전환한다.
  public void markSent(Instant now) {
    transitionTo(AgentTaskStatus.SENT);
    this.sentAt = now;
    this.failureReason = null;
  }

  // 워커가 메시지를 받았음을 ack 했을 때 호출한다.
  public void markAcked(Instant now) {
    transitionTo(AgentTaskStatus.ACKED);
    this.ackedAt = now;
    this.failureReason = null;
  }

  // 실제 분석/적재 처리를 시작한 시점을 기록한다.
  public void markRunning(Instant now) {
    transitionTo(AgentTaskStatus.RUNNING);
    this.startedAt = now;
    this.failureReason = null;
  }

  // 적재 재시도 대기 상태에서는 RUNNING을 유지한 채 마지막 실패 사유만 덮어쓴다.
  public void markRetryPending(String failureReason) {
    if (this.taskStatus != AgentTaskStatus.RUNNING && this.taskStatus != AgentTaskStatus.ACKED) {
      throw new IllegalStateException("Retry pending is only allowed for ACKED or RUNNING task");
    }
    this.failureReason = failureReason;
  }

  // 작업이 정상 종료되면 완료 시각과 함께 종료 상태를 남긴다.
  public void markSucceeded(Instant now) {
    transitionTo(AgentTaskStatus.SUCCEEDED);
    this.completedAt = now;
    this.failureReason = null;
  }

  // 작업 처리 중 장애가 나면 종료 상태와 사유를 함께 남긴다.
  public void markFailed(Instant now, String failureReason) {
    transitionTo(AgentTaskStatus.FAILED);
    this.completedAt = now;
    this.failureReason = failureReason;
  }

  // 사용자 취소나 정책상 중단 시 취소 상태와 사유를 함께 남긴다.
  public void markCanceled(Instant now, String failureReason) {
    transitionTo(AgentTaskStatus.CANCELED);
    this.completedAt = now;
    this.failureReason = failureReason;
  }

  private void transitionTo(AgentTaskStatus nextStatus) {
    this.taskStatus.assertTransitionAllowed(nextStatus);
    this.taskStatus = nextStatus;
  }
}
