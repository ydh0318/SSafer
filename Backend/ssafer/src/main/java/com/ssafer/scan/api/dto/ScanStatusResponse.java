package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

// 스캔 상태 조회 API 전용 응답 DTO.
// 기존 기본 조회 DTO(ScanBasicResponse)보다 필요한 필드만 간결하게 노출한다.
public record ScanStatusResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "현재 스캔 상태", example = "RUNNING")
    ScanStatus status,
    @Schema(description = "현재 처리 단계", example = "ANALYSIS_RUNNING")
    String progressStep,
    @Schema(description = "스캔 요청 시각", example = "2026-04-27T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "스캔 시작 시각", example = "2026-04-27T09:01:00")
    LocalDateTime startedAt,
    @Schema(description = "스캔 완료 시각", example = "2026-04-27T09:10:00")
    LocalDateTime completedAt,
    @Schema(description = "실패 사유", example = "Agent connection timeout")
    String errorMessage
) {
}
