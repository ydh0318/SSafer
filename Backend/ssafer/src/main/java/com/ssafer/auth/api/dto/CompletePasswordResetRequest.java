package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 재설정 완료 요청")
public record CompletePasswordResetRequest(
    @Schema(description = "비밀번호를 재설정할 이메일", example = "user@ssafer.co.kr")
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "올바른 이메일 형식이어야 합니다.")
    @Size(max = 255, message = "이메일은 255자 이하여야 합니다.")
    String email,
    @Schema(description = "새 비밀번호", example = "new-password123")
    @NotBlank(message = "새 비밀번호는 필수입니다.")
    @Size(min = 8, max = 72, message = "새 비밀번호는 8자 이상 72자 이하여야 합니다.")
    String newPassword
) {
}
