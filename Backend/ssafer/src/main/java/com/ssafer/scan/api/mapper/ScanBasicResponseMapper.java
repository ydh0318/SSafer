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
        // raw 결과와 최종 analysis 결과 경로를 둘 다 내려야 프론트가 현재 단계에 맞는 아티팩트를 참조할 수 있다.
        scan.getAnalysisResultPath(),
        scan.getRequestedAt(),
        scan.getStartedAt(),
        scan.getCompletedAt(),
        scan.getLastUpdatedAt()
    );
  }
}
