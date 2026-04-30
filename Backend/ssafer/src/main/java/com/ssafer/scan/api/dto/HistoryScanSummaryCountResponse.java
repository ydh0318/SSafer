package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

// 히스토리 화면 상단에서 바로 사용할 수 있는 전체 요약 count DTO다.
// 스캔 상태 분포보다 "전체적으로 어떤 위험도가 얼마나 쌓였는지"를 보여주는 데 초점을 둔다.
public record HistoryScanSummaryCountResponse(
    @Schema(description = "전체 스캔 개수", example = "12")
    long totalScanCount,
    @Schema(description = "전체 파인딩 개수", example = "37")
    long totalFindingCount,
    @Schema(description = "CRITICAL 위험도 파인딩 개수", example = "2")
    long criticalCount,
    @Schema(description = "HIGH 위험도 파인딩 개수", example = "8")
    long highCount,
    @Schema(description = "MEDIUM 위험도 파인딩 개수", example = "14")
    long mediumCount,
    @Schema(description = "LOW 위험도 파인딩 개수", example = "9")
    long lowCount,
    @Schema(description = "INFO 위험도 파인딩 개수", example = "4")
    long infoCount
) {
}
