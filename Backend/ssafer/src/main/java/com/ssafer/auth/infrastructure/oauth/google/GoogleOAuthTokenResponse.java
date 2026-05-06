package com.ssafer.auth.infrastructure.oauth.google;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GoogleOAuthTokenResponse(
    @JsonProperty("access_token")
    String accessToken,
    @JsonProperty("token_type")
    String tokenType,
    @JsonProperty("id_token")
    String idToken,
    @JsonProperty("expires_in")
    Long expiresIn,
    String scope
) {
}
