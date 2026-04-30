package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

// 전체 히스토리 목록에서 스캔 1건을 표현하는 응답 DTO다.
// 목록 화면에서 각 스캔의 위험도를 바로 비교할 수 있도록 총 파인딩 수와 위험도별 개수를 함께 담는다.
public record HistoryScanListItemResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "스캔 상태", example = "DONE")
    ScanStatus status,
    @Schema(description = "스캔 모드", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "해당 스캔의 전체 파인딩 개수", example = "12")
    long totalFindingCount,
    @Schema(description = "해당 스캔의 CRITICAL 위험도 파인딩 개수", example = "1")
    long criticalCount,
    @Schema(description = "해당 스캔의 HIGH 위험도 파인딩 개수", example = "3")
    long highCount,
    @Schema(description = "해당 스캔의 MEDIUM 위험도 파인딩 개수", example = "5")
    long mediumCount,
    @Schema(description = "해당 스캔의 LOW 위험도 파인딩 개수", example = "2")
    long lowCount,
    @Schema(description = "해당 스캔의 INFO 위험도 파인딩 개수", example = "1")
    long infoCount,
    @Schema(description = "스캔 요청 시각", example = "2026-04-27T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "스캔 완료 시각", example = "2026-04-27T09:10:00")
    LocalDateTime completedAt
) {
}
