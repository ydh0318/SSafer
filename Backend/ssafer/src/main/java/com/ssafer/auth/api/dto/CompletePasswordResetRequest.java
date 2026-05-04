package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 재설정 완료 요청")
public record CompletePasswordResetRequest(
    @Schema(description = "코드 검증 후 발급된 재설정 토큰", example = "c25d6fa2-4c8e-4f4f-b4fd-4c7fa1e809a2")
    @NotBlank(message = "재설정 토큰은 필수입니다.")
    @Size(max = 100, message = "재설정 토큰 길이가 올바르지 않습니다.")
    String resetToken,
    @Schema(description = "새 비밀번호", example = "new-password123")
    @NotBlank(message = "새 비밀번호는 필수입니다.")
    @Size(min = 8, max = 72, message = "새 비밀번호는 8자 이상 72자 이하여야 합니다.")
    String newPassword
) {
}
