package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.user.domain.enums.AccountStatus;

// OAuth 제공자 정보와 기존 사용자 매칭 결과를 함께 컨트롤러에 전달한다.
public record OAuthLoginResult(
    OAuthProvider provider,
    String providerUserId,
    String email,
    String displayName,
    boolean existingUserMatched,
    Long existingUserId,
    AccountStatus existingUserAccountStatus
) {
}
