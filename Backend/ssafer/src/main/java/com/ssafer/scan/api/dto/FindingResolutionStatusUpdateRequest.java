package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ResolutionStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record FindingResolutionStatusUpdateRequest(
    @NotNull
    @Schema(description = "변경할 finding 조치 상태", example = "RESOLVED")
    ResolutionStatus status,

    @Schema(description = "수동 상태 변경 사유", example = "운영 설정에서 수동 조치 완료 확인")
    String reason
) {

  public String normalizedReason() {
    if (reason == null) {
      return null;
    }
    String trimmed = reason.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
