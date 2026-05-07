package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;

// 제공자별 OAuth 응답을 공통 로그인 흐름에서 다루기 위한 최소 사용자 정보다.
public record OAuthProviderUserInfo(
    OAuthProvider provider,
    String providerUserId,
    String email,
    String displayName
) {
}
