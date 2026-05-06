package com.ssafer.auth.infrastructure.oauth.github;

public record GithubOAuthEmailResponse(
    String email,
    Boolean primary,
    Boolean verified,
    String visibility
) {
}
