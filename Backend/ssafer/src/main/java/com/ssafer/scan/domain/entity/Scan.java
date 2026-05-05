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
 * Raw 결과 업로드 API는 이 엔티티의 raw result 관련 필드만 갱신한다.
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

  @Column(name = "requested_at", nullable = false)
  private LocalDateTime requestedAt;

  @Column(name = "started_at")
  private LocalDateTime startedAt;

  @Column(name = "completed_at")
  private LocalDateTime completedAt;

  @Column(name = "last_updated_at", nullable = false)
  private LocalDateTime lastUpdatedAt;

  /**
   * 내부 raw 결과 업로드 시점에 바뀌는 필드만 한 번에 갱신한다.
   * scan 생성에 쓰이는 식별/소유 필드는 여기서 변경하지 않는다.
   */
  public void updateRawResult(
      ScanStatus status,
      String progressStep,
      String failureReason,
      String rawResultJson,
      String rawResultPath,
      LocalDateTime startedAt,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt) {
    this.status = status;
    this.progressStep = progressStep;
    this.failureReason = failureReason;
    this.rawResultJson = rawResultJson;
    this.rawResultPath = rawResultPath;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  // CLI raw 결과 업로드 완료 알림을 작업 큐에 실은 뒤 대기 상태로 전환한다.
  public void markQueued(String progressStep, String rawResultJson, LocalDateTime startedAt, LocalDateTime lastUpdatedAt) {
    this.status = ScanStatus.QUEUED;
    this.progressStep = progressStep;
    this.failureReason = null;
    this.rawResultJson = rawResultJson;
    this.startedAt = startedAt;
    this.completedAt = null;
    this.lastUpdatedAt = lastUpdatedAt;
  }
}
