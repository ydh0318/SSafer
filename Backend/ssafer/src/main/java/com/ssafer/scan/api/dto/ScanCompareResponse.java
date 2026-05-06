package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;

// 결과 비교 API의 첫 단계 응답 DTO다.
// 이후 태스크에서 summary와 분류 결과를 여기에 확장한다.
public record ScanCompareResponse(
    @Schema(description = "비교 기준 스캔 ID", example = "1001")
    Long baseScanId,
    @Schema(description = "비교 대상 스캔 ID", example = "1002")
    Long targetScanId,
    @Schema(description = "비교 대상 프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "기준 스캔 상태", example = "DONE")
    ScanStatus baseStatus,
    @Schema(description = "대상 스캔 상태", example = "DONE")
    ScanStatus targetStatus
) {
}
