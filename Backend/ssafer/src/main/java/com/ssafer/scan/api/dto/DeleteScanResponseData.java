package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public record DeleteScanResponseData(
    @Schema(description = "삭제 처리된 스캔 ID", example = "1001")
    Long scanId,

    @Schema(description = "삭제 처리 시각(UTC)", example = "2026-04-27T09:20:00Z")
    Instant deletedAt
) {
}
