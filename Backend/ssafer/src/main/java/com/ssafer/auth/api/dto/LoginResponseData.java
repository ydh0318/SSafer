package com.ssafer.auth.api.dto;

import java.time.Instant;

public record LoginResponseData(
    String accessToken,
    Instant accessTokenExpiresAt,
    String refreshToken,
    Instant refreshTokenExpiresAt
) {
}
