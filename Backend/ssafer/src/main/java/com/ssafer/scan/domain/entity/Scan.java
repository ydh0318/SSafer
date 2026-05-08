package com.ssafer.scan.domain.entity;

import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 스캔 요청부터 실행, 결과 적재까지의 전체 상태를 표현하는 루트 엔티티다.
 * CLI 완료 알림과 워커 완료 콜백은 이 엔티티의 상태와 결과 경로를 전이시킨다.
 */
@Getter
@Builder
@Entity
@Table(name = "scans")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Scan {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "external_scan_id", length = 100)
  private String externalScanId;

  @Column(name = "project_id", nullable = false)
  private Long projectId;

  @Column(name = "requested_by_user_id")
  private Long requestedByUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "request_actor_type", nullable = false, length = 20)
  private RequestActorType requestActorType;

  @Column(name = "agent_id")
  private Long agentId;

  @Column(name = "custom_rule_set_id")
  private Long customRuleSetId;

  @Column(name = "parent_scan_id")
  private Long parentScanId;

  @Enumerated(EnumType.STRING)
  @Column(name = "scan_mode", nullable = false, length = 20)
  private ScanMode scanMode;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private ScanStatus status;

  @Column(name = "progress_step", length = 100)
  private String progressStep;

  @Column(name = "failure_reason", columnDefinition = "text")
  private String failureReason;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "target_snapshot_json")
  private String targetSnapshotJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_result_json")
  private String rawResultJson;

  @Column(name = "raw_result_path", length = 500)
  private String rawResultPath;

  @Column(name = "analysis_result_path", length = 500)
  private String analysisResultPath;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @Column(name = "requested_at", nullable = false)
  private LocalDateTime requestedAt;

  @Column(name = "started_at")
  private LocalDateTime startedAt;

  @Column(name = "completed_at")
  private LocalDateTime completedAt;

  @Column(name = "last_updated_at", nullable = false)
  private LocalDateTime lastUpdatedAt;

  /**
   * CLI raw 결과 업로드 완료 보고처럼 raw 결과 필드만 한 번에 갱신할 때 사용한다.
   * scan 생성 주체나 대상 정보는 바꾸지 않는다.
   */
  public void updateRawResult(
      ScanStatus status,
      String progressStep,
      String failureReason,
      String rawResultJson,
      String rawResultPath,
      LocalDateTime startedAt,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt
  ) {
    this.status.assertTransitionAllowed(status);
    this.status = status;
    this.progressStep = progressStep;
    this.failureReason = failureReason;
    this.rawResultJson = rawResultJson;
    this.rawResultPath = rawResultPath;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // 워커 콜백을 받아 적재를 백그라운드로 넘기기 직전 RUNNING 상태로 전환한다.
  public void markAnalysisQueuedForIngestion(
      String progressStep,
      String analysisResultPath,
      LocalDateTime startedAt,
      LocalDateTime lastUpdatedAt
  ) {
    this.status.assertTransitionAllowed(ScanStatus.RUNNING);
    this.status = ScanStatus.RUNNING;
    this.progressStep = progressStep;
    this.failureReason = null;
    this.analysisResultPath = analysisResultPath;
    this.startedAt = startedAt;
    this.completedAt = null;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // 적재가 최종 완료되면 DONE 상태와 완료 시각을 남긴다.
  public void markAnalysisCompleted(
      String progressStep,
      LocalDateTime startedAt,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt
  ) {
    this.status.assertTransitionAllowed(ScanStatus.DONE);
    this.status = ScanStatus.DONE;
    this.progressStep = progressStep;
    this.failureReason = null;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // 적재 job이 실패하면 실패 사유와 종료 시각을 함께 남긴다.
  public void markAnalysisFailed(
      String progressStep,
      String failureReason,
      LocalDateTime startedAt,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt
  ) {
    this.status.assertTransitionAllowed(ScanStatus.FAILED);
    this.status = ScanStatus.FAILED;
    this.progressStep = progressStep;
    this.failureReason = failureReason;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // 비동기 적재 도중 일시 실패가 나면 RUNNING 상태는 유지하고 재시도 정보를 남긴다.
  public void markAnalysisRetryPending(
      String progressStep,
      String failureReason,
      LocalDateTime startedAt,
      LocalDateTime lastUpdatedAt
  ) {
    this.status.assertTransitionAllowed(ScanStatus.RUNNING);
    this.status = ScanStatus.RUNNING;
    this.progressStep = progressStep;
    this.failureReason = failureReason;
    this.startedAt = startedAt;
    this.completedAt = null;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // CLI raw 결과 업로드 완료 알림 이후 작업 큐에 올린 대기 상태로 전환한다.
  public void markQueued(String progressStep, String rawResultJson, LocalDateTime startedAt, LocalDateTime lastUpdatedAt) {
    this.status.assertTransitionAllowed(ScanStatus.QUEUED);
    this.status = ScanStatus.QUEUED;
    this.progressStep = progressStep;
    this.failureReason = null;
    this.rawResultJson = rawResultJson;
    this.startedAt = startedAt;
    this.completedAt = null;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  public boolean isDeleted() {
    return deletedAt != null;
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }
}
