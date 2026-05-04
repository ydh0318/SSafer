package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 찾기 인증코드 전송 요청")
public record SendPasswordResetCodeRequest(
    @Schema(description = "인증코드를 받을 이메일", example = "user@ssafer.co.kr")
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "올바른 이메일 형식이어야 합니다.")
    @Size(max = 255, message = "이메일은 255자 이하여야 합니다.")
    String email
) {
}
