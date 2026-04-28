package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "이메일 중복 확인 응답 데이터")
public record CheckEmailResponseData(
    @Schema(description = "사용 가능 여부", example = "true")
    boolean available
) {
}
