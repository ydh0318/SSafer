package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "회원가입 응답 데이터")
public record RegisterUserResponseData(
    @Schema(description = "생성된 회원 ID", example = "1")
    Long userId
) {
}
