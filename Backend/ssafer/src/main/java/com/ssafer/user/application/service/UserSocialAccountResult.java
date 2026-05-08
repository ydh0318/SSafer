package com.ssafer.user.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import java.time.Instant;

public record UserSocialAccountResult(
    OAuthProvider provider,
    boolean connected,
    String email,
    Instant connectedAt
) {
}
