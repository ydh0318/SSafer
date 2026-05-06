package com.ssafer.auth.infrastructure.oauth.github;

public record GithubOAuthUserResponse(
    Long id,
    String login,
    String name
) {
}
