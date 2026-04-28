package com.ssafer.scan.api.mapper;

import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.domain.entity.ScanFinding;

public final class ScanFindingListResponseMapper {

  private ScanFindingListResponseMapper() {
  }

  // 목록 조회는 화면에 바로 필요한 핵심 메타데이터만 가볍게 내려준다.
  public static ScanFindingListItemResponse toResponse(ScanFinding finding) {
    return new ScanFindingListItemResponse(
        finding.getId(),
        finding.getScanId(),
        finding.getScanNodeId(),
        finding.getSourceType(),
        finding.getSeverity(),
        finding.getCategory(),
        finding.getTitle(),
        finding.getFilePath(),
        finding.getLineNumber(),
        finding.getResourceName(),
        finding.getRuleCode(),
        finding.getResolutionStatus(),
        finding.getCreatedAt()
    );
  }
}
