package com.ssafer.scan.domain.entity;

import com.ssafer.scan.domain.enums.FindingSourceType;
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

  @Enumerated(EnumType.STRING)
  @Column(name = "resolution_status", nullable = false, length = 20)
  private ResolutionStatus resolutionStatus;

  @Column(name = "patch_approved_by_user_id")
  private Long patchApprovedByUserId;

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
}
