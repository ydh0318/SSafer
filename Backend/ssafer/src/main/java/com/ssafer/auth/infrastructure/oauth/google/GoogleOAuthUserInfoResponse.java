package com.ssafer.auth.infrastructure.oauth.google;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GoogleOAuthUserInfoResponse(
    String sub,
    String email,
    @JsonProperty("email_verified")
    Boolean emailVerified,
    String name
) {
}
