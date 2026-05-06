package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.user.domain.enums.AccountStatus;
import java.time.Instant;

// OAuth 로그인 완료 후 사용자 정보와 JWT 발급 결과를 함께 컨트롤러로 전달한다.
public record OAuthLoginResult(
    OAuthProvider provider,
    String providerUserId,
    String email,
    String displayName,
    boolean newUserCreated,
    Long userId,
    AccountStatus accountStatus,
    String accessToken,
    Instant accessTokenExpiresAt,
    String refreshToken,
    Instant refreshTokenExpiresAt
) {
}
