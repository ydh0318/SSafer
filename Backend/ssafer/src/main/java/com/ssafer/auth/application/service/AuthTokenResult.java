package com.ssafer.auth.application.service;

import java.time.Instant;

public record AuthTokenResult(
    String accessToken,
    Instant accessTokenExpiresAt,
    String refreshToken,
    Instant refreshTokenExpiresAt
) {
}
