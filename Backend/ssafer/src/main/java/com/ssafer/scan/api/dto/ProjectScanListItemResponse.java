package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

// 프로젝트 스캔 목록의 단건 항목 DTO.
public record ProjectScanListItemResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "스캔 상태", example = "DONE")
    ScanStatus status,
    @Schema(description = "스캔 모드", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "스캔 요청 시각", example = "2026-04-27T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "스캔 완료 시각", example = "2026-04-27T09:10:00")
    LocalDateTime completedAt
) {
}
