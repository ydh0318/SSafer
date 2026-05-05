package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "닉네임 중복 확인 응답 데이터")
public record CheckNicknameResponseData(
    @Schema(description = "사용 가능한 닉네임 여부", example = "true")
    boolean available
) {
}
