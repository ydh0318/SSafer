package com.ssafer.scan.domain.entity;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;

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

@Getter
@Builder
@Entity
@Table(name = "scan_findings")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ScanFinding {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "scan_id", nullable = false)
  private Long scanId;

  @Column(name = "scan_nodes_id", nullable = false)
  private Long scanNodeId;

  @Enumerated(EnumType.STRING)
  @Column(name = "source_type", nullable = false, length = 20)
  private FindingSourceType sourceType;

  @Column(nullable = false, length = 255)
  private String fingerprint;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private Severity severity;

  @Column(nullable = false, length = 100)
  private String category;

  @Column(nullable = false, length = 255)
  private String title;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "file_path", length = 500)
  private String filePath;

  @Column(name = "line_number")
  private Integer lineNumber;

  @Column(name = "resource_name", length = 255)
  private String resourceName;

  @Column(name = "rule_code", length = 100)
  private String ruleCode;

  @Column(name = "attack_scenario", columnDefinition = "text")
  private String attackScenario;

  @Column(name = "remediation_guide", columnDefinition = "text")
  private String remediationGuide;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_snippet_json")
  private String rawSnippetJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "patch_payload_json")
  private String patchPayloadJson;

  @Enumerated(EnumType.STRING)
  @Column(name = "resolution_status", nullable = false, length = 20)
  private ResolutionStatus resolutionStatus;

  @Column(name = "patch_approved_by_user_id")
  private Long patchApprovedByUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "patch_approved_actor_type", length = 20)
  private RequestActorType patchApprovedActorType;

  @Column(name = "patch_approved_by_guest_owner_key_hash", length = 255)
  private String patchApprovedByGuestOwnerKeyHash;

  @Column(name = "patch_approved_at")
  private LocalDateTime patchApprovedAt;

  @Column(name = "patch_result_message", columnDefinition = "text")
  private String patchResultMessage;

  @Column(name = "backup_file_name", length = 255)
  private String backupFileName;

  @Column(name = "backup_file_path", length = 500)
  private String backupFilePath;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "backup_metadata_json")
  private String backupMetadataJson;

  @Column(name = "patched_at")
  private LocalDateTime patchedAt;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  public void backfillPatchPayload(String patchPayloadJson) {
    if ((this.patchPayloadJson == null || this.patchPayloadJson.isBlank())
        && patchPayloadJson != null
        && !patchPayloadJson.isBlank()) {
      this.patchPayloadJson = patchPayloadJson;
    }
  }

  public void approvePatch(AuthenticatedActor actor, LocalDateTime approvedAt) {
    this.patchApprovedActorType = actor.isMember() ? RequestActorType.USER : RequestActorType.GUEST;
    this.patchApprovedByUserId = actor.isMember() ? actor.userId() : null;
    this.patchApprovedByGuestOwnerKeyHash = actor.isGuest() ? actor.guestOwnerKeyHash() : null;
    this.patchApprovedAt = approvedAt;
    this.resolutionStatus = ResolutionStatus.IN_PROGRESS;
  }

  public void markPatchResolved(
      String patchResultMessage,
      String backupFileName,
      String backupFilePath,
      String backupMetadataJson,
      LocalDateTime patchedAt
  ) {
    // Local Agent가 패치를 성공했다고 보고하면 finding을 조치 완료 상태로 확정한다.
    this.resolutionStatus = ResolutionStatus.RESOLVED;
    this.patchResultMessage = patchResultMessage;
    this.backupFileName = backupFileName;
    this.backupFilePath = backupFilePath;
    this.backupMetadataJson = backupMetadataJson;
    this.patchedAt = patchedAt;
  }

  public void markPatchFailed(String patchResultMessage, String backupMetadataJson) {
    // 패치 실패 시에는 다시 승인/재시도할 수 있도록 OPEN 상태로 되돌린다.
    this.resolutionStatus = ResolutionStatus.OPEN;
    this.patchResultMessage = patchResultMessage;
    this.backupFileName = null;
    this.backupFilePath = null;
    this.backupMetadataJson = backupMetadataJson;
    this.patchedAt = null;
  }
}
