package com.ssafer.scan.api.mapper;

import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.domain.entity.Scan;

public final class ScanBasicResponseMapper {

  private ScanBasicResponseMapper() {
  }

  public static ScanBasicResponse toResponse(Scan scan) {
    return new ScanBasicResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getScanMode(),
        ScanRequestSourceResolver.resolve(scan),
        scan.getScanType(),
        scan.getStatus(),
        scan.getProgressStep(),
        scan.getFailureReason(),
        scan.getRawResultPath(),
        scan.getRequestedAt(),
        scan.getStartedAt(),
        scan.getCompletedAt(),
        scan.getLastUpdatedAt()
    );
  }
}
