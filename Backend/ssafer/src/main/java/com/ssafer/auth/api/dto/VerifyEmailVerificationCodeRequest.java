package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "이메일 인증 코드 확인 요청")
public record VerifyEmailVerificationCodeRequest(
    @Schema(description = "인증을 완료할 이메일", example = "user@ssafer.co.kr")
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "올바른 이메일 형식이어야 합니다.")
    @Size(max = 255, message = "이메일은 255자 이하여야 합니다.")
    String email,
    @Schema(description = "이메일로 발송된 6자리 인증 코드", example = "123456")
    @NotBlank(message = "인증 코드는 필수입니다.")
    @Pattern(regexp = "\\d{6}", message = "인증 코드는 6자리 숫자여야 합니다.")
    String code
) {
}
