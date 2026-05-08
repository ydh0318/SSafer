package com.ssafer.auth.infrastructure.oauth.github;

import java.util.List;

public interface GithubOAuthApiClient {

  GithubOAuthTokenResponse exchangeAuthorizationCode(String authorizationCode, String redirectUri);

  GithubOAuthUserResponse fetchUserInfo(String accessToken);

  List<GithubOAuthEmailResponse> fetchUserEmails(String accessToken);
}
