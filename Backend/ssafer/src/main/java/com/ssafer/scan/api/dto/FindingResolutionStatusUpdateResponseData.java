package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ResolutionStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record FindingResolutionStatusUpdateResponseData(
    @Schema(description = "finding ID", example = "2001")
    Long findingId,
    @Schema(description = "scan ID", example = "1001")
    Long scanId,
    @Schema(description = "변경 전 조치 상태", example = "OPEN")
    ResolutionStatus previousStatus,
    @Schema(description = "변경 후 조치 상태", example = "RESOLVED")
    ResolutionStatus resolutionStatus
) {
}
