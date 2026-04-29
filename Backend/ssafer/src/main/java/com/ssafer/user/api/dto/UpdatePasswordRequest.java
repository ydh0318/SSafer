package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "비밀번호 변경 요청")
public record UpdatePasswordRequest(
    @Schema(description = "현재 비밀번호", example = "password123")
    String currentPassword,
    @Schema(description = "새 비밀번호", example = "new-password123")
    String newPassword
) {
}
