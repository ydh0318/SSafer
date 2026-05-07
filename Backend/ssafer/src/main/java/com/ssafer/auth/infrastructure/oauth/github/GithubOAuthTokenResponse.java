package com.ssafer.auth.infrastructure.oauth.github;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GithubOAuthTokenResponse(
    @JsonProperty("access_token")
    String accessToken,
    @JsonProperty("token_type")
    String tokenType,
    String scope
) {
}
