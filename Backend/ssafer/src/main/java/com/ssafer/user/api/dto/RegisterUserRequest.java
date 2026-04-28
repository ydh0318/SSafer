package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "회원가입 요청")
public record RegisterUserRequest(
    @Schema(description = "로그인에 사용할 이메일", example = "test@example.com")
    String email,
    @Schema(description = "서비스에서 표시할 사용자명", example = "Alice")
    String displayName,
    @Schema(description = "로그인 비밀번호", example = "password123")
    String password
) {
}
