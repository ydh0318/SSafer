package com.ssafer.scan.api.mapper;

import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.domain.entity.ScanFinding;

public final class ScanFindingDetailResponseMapper {

  private ScanFindingDetailResponseMapper() {
  }

  // 상세 조회에서는 목록보다 많은 원문/패치 관련 정보를 함께 내려준다.
  public static ScanFindingDetailResponse toResponse(ScanFinding finding) {
    return new ScanFindingDetailResponse(
        finding.getId(),
        finding.getScanId(),
        finding.getScanNodeId(),
        finding.getSourceType(),
        finding.getFingerprint(),
        finding.getSeverity(),
        finding.getCategory(),
        finding.getTitle(),
        finding.getDescription(),
        finding.getFilePath(),
        finding.getLineNumber(),
        finding.getResourceName(),
        finding.getRuleCode(),
        finding.getAttackScenario(),
        finding.getRemediationGuide(),
        finding.getRawSnippetJson(),
        finding.getPatchPayloadJson(),
        finding.getResolutionStatus(),
        finding.getPatchApprovedByUserId(),
        finding.getPatchApprovedAt(),
        finding.getPatchResultMessage(),
        finding.getBackupFileName(),
        finding.getBackupFilePath(),
        finding.getBackupMetadataJson(),
        finding.getPatchedAt(),
        finding.getCreatedAt()
    );
  }
}
