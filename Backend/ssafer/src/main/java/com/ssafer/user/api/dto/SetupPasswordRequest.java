package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SetupPasswordRequest(
    @Schema(description = "새 비밀번호", example = "new-password123")
    @NotBlank
    @Size(min = 8, max = 72)
    String newPassword
) {
}
