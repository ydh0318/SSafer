package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthApiClient;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthEmailResponse;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthTokenResponse;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthUserResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class GithubOAuthLoginProviderHandlerTest {

  private GithubOAuthApiClient githubOAuthApiClient;
  private GithubOAuthLoginProviderHandler handler;

  @BeforeEach
  void setUp() {
    githubOAuthApiClient = Mockito.mock(GithubOAuthApiClient.class);
    handler = new GithubOAuthLoginProviderHandler(githubOAuthApiClient);
  }

  @Test
  void fetchUserInfoThrowsUnauthorizedWhenGithubHasNoVerifiedEmail() {
    given(githubOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost/callback"))
        .willReturn(new GithubOAuthTokenResponse("access-token", "bearer", "read:user user:email"));
    given(githubOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GithubOAuthUserResponse(101L, "alice", "Alice"));
    given(githubOAuthApiClient.fetchUserEmails("access-token"))
        .willReturn(List.of(new GithubOAuthEmailResponse("user@ssafer.co.kr", true, false, "public")));

    assertThatThrownBy(() -> handler.fetchUserInfo("auth-code", "http://localhost/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
  }
}
