package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ResolutionStatusSource;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record FindingResolutionStatusUpdateResponseData(
    @Schema(description = "finding ID", example = "2001")
    Long findingId,
    @Schema(description = "scan ID", example = "1001")
    Long scanId,
    @Schema(description = "변경 전 조치 상태", example = "OPEN")
    ResolutionStatus previousStatus,
    @Schema(description = "변경 후 조치 상태", example = "RESOLVED")
    ResolutionStatus resolutionStatus,
    @Schema(description = "상태 변경 출처", example = "MANUAL")
    ResolutionStatusSource resolutionStatusSource,
    @Schema(description = "상태 변경 주체 유형", example = "USER")
    RequestActorType resolutionStatusChangedActorType,
    @Schema(description = "상태 변경 사용자 ID", example = "1")
    Long resolutionStatusChangedByUserId,
    @Schema(description = "상태 변경 시각", example = "2026-05-19T11:10:00")
    LocalDateTime resolutionStatusChangedAt
) {
}
