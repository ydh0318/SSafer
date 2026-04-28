package com.ssafer.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "자체 로그인 응답 데이터")
public record LoginResponseData(
    @Schema(description = "보호 API 호출에 사용하는 access token")
    String accessToken,
    @Schema(description = "access token 만료 시각", example = "2026-04-29T12:00:00Z")
    Instant accessTokenExpiresAt,
    @Schema(description = "토큰 재발급에 사용하는 refresh token")
    String refreshToken,
    @Schema(description = "refresh token 만료 시각", example = "2026-05-13T12:00:00Z")
    Instant refreshTokenExpiresAt
) {
}
