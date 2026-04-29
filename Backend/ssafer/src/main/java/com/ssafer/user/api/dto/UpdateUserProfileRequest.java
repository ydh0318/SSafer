package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "사용자 설정 수정 요청")
public record UpdateUserProfileRequest(
    @Schema(description = "설정 화면에 표시할 사용자명", example = "Alice")
    @NotBlank(message = "사용자명은 필수입니다.")
    @Size(max = 100, message = "사용자명은 100자 이하여야 합니다.")
    String displayName
) {
}
