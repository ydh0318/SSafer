package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "비밀번호 재설정 코드 검증 응답 데이터")
public record VerifyPasswordResetCodeResponseData(
    @Schema(description = "비밀번호 재설정 완료 요청에 사용할 1회성 토큰")
    String resetToken
) {
}
