package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 변경 요청")
public record UpdatePasswordRequest(
    @Schema(description = "현재 비밀번호", example = "password123")
    @NotBlank(message = "현재 비밀번호는 필수입니다.")
    @Size(min = 8, max = 72, message = "현재 비밀번호는 8자 이상 72자 이하여야 합니다.")
    String currentPassword,
    @Schema(description = "새 비밀번호", example = "new-password123")
    @NotBlank(message = "새 비밀번호는 필수입니다.")
    @Size(min = 8, max = 72, message = "새 비밀번호는 8자 이상 72자 이하여야 합니다.")
    String newPassword
) {
}
