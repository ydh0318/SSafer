package com.ssafer.scan.api.mapper;

import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.domain.entity.Scan;

/**
 * Scan 엔티티를 기본 조회 응답 DTO로 변환한다.
 */
public final class ScanBasicResponseMapper {

  private ScanBasicResponseMapper() {
  }

  public static ScanBasicResponse toResponse(Scan scan) {
    return new ScanBasicResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getScanMode(),
        scan.getStatus(),
        scan.getProgressStep(),
        scan.getFailureReason(),
        scan.getRawResultPath(),
        scan.getRequestedAt(),
        scan.getStartedAt(),
        scan.getCompletedAt(),
        scan.getLastUpdatedAt());
  }
}
