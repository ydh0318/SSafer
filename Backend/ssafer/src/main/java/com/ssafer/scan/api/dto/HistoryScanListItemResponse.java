package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

// 전체 히스토리 목록에서 스캔 1건을 표현하는 기본 응답 DTO다.
// 이번 단계에서는 API 연결에 필요한 최소 필드만 먼저 내려주고,
// 이후 커밋에서 요약 count나 추가 표시 필드를 확장한다.
public record HistoryScanListItemResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId,
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
