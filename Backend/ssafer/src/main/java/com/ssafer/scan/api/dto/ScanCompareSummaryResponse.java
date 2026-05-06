package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

// 결과 비교 상단 요약 카드에 사용할 개수 응답이다.
public record ScanCompareSummaryResponse(
    @Schema(description = "기준 스캔 취약점 개수", example = "12")
    long baseFindingCount,
    @Schema(description = "대상 스캔 취약점 개수", example = "11")
    long targetFindingCount,
    @Schema(description = "신규 발생 취약점 개수", example = "3")
    long newCount,
    @Schema(description = "해결된 취약점 개수", example = "2")
    long resolvedCount,
    @Schema(description = "심각도 변화 없이 유지된 취약점 개수", example = "5")
    long retainedCount,
    @Schema(description = "심각도가 변경된 취약점 개수", example = "1")
    long severityChangedCount
) {
}
