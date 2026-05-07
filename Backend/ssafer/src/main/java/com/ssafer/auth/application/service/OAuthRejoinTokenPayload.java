package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;

public record OAuthRejoinTokenPayload(
    Long userId,
    OAuthProvider provider,
    String providerUserId,
    String email,
    String displayName
) {
}
