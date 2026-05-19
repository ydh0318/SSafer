package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ResolutionStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record FindingResolutionStatusUpdateRequest(
    @NotNull
    @Schema(description = "변경할 finding 조치 상태", example = "RESOLVED")
    ResolutionStatus status
) {
}
