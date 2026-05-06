package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.user.domain.enums.AccountStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public record OAuthLoginResponseData(
    @Schema(description = "OAuth 제공자", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "OAuth 제공자 사용자 식별자", example = "google-user-123")
    String providerUserId,
    @Schema(description = "OAuth 제공자에게서 받은 이메일", example = "user@ssafer.co.kr")
    String email,
    @Schema(description = "OAuth 제공자에게서 받은 표시 이름", example = "싸피맨")
    String displayName,
    @Schema(description = "이번 로그인에서 신규 사용자 생성 여부", example = "false")
    boolean newUserCreated,
    @Schema(description = "로그인 처리된 사용자 ID", example = "1")
    Long userId,
    @Schema(description = "로그인 처리된 사용자 계정 상태", example = "ACTIVE")
    AccountStatus accountStatus,
    @Schema(description = "보호 API 호출에 사용하는 access token")
    String accessToken,
    @Schema(description = "access token 만료 시각", example = "2026-05-06T12:00:00Z")
    Instant accessTokenExpiresAt,
    @Schema(description = "토큰 재발급에 사용하는 refresh token")
    String refreshToken,
    @Schema(description = "refresh token 만료 시각", example = "2026-05-20T12:00:00Z")
    Instant refreshTokenExpiresAt
) {
}
