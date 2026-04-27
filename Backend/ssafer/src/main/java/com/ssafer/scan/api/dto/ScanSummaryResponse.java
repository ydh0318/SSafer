package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

public record ScanSummaryResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "전체 finding 개수", example = "12")
    long totalFindings,
    @Schema(description = "결과가 저장된 노드 개수", example = "3")
    long nodeCount,
    @Schema(description = "CRITICAL 개수", example = "1")
    long criticalCount,
    @Schema(description = "HIGH 개수", example = "2")
    long highCount,
    @Schema(description = "MEDIUM 개수", example = "4")
    long mediumCount,
    @Schema(description = "LOW 개수", example = "3")
    long lowCount,
    @Schema(description = "INFO 개수", example = "2")
    long infoCount,
    @Schema(description = "카테고리별 개수", example = "{\"CONFIG\": 2, \"SECRET\": 1}")
    Map<String, Long> categoryCounts,
    @Schema(description = "탐지 출처별 개수", example = "{\"TRIVY\": 2, \"CUSTOM_RULE\": 1}")
    Map<String, Long> sourceCounts,
    @Schema(description = "조치 상태별 개수", example = "{\"OPEN\": 3}")
    Map<String, Long> resolutionCounts
) {
}
