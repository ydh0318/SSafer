package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.auth.domain.enums.OAuthProvider;
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
  void fetchUserInfoExchangesCodeAndReturnsGithubUserInfo() {
    given(githubOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:5173/oauth/github/callback"))
        .willReturn(new GithubOAuthTokenResponse("access-token", "bearer", "read:user user:email"));
    given(githubOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GithubOAuthUserResponse(101L, "ssafer-dev", "싸피맨"));
    given(githubOAuthApiClient.fetchUserEmails("access-token"))
        .willReturn(List.of(
            new GithubOAuthEmailResponse("secondary@ssafer.co.kr", false, true, null),
            new GithubOAuthEmailResponse("primary@ssafer.co.kr", true, true, null)
        ));

    OAuthProviderUserInfo result = handler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback");

    assertThat(result.provider()).isEqualTo(OAuthProvider.GITHUB);
    assertThat(result.providerUserId()).isEqualTo("101");
    assertThat(result.email()).isEqualTo("primary@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("싸피맨");
  }

  @Test
  void fetchUserInfoFallsBackToAnyVerifiedEmailWhenPrimaryEmailIsMissing() {
    given(githubOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:5173/oauth/github/callback"))
        .willReturn(new GithubOAuthTokenResponse("access-token", "bearer", "read:user user:email"));
    given(githubOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GithubOAuthUserResponse(101L, "ssafer-dev", ""));
    given(githubOAuthApiClient.fetchUserEmails("access-token"))
        .willReturn(List.of(
            new GithubOAuthEmailResponse("verified@ssafer.co.kr", false, true, null)
        ));

    OAuthProviderUserInfo result = handler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback");

    assertThat(result.email()).isEqualTo("verified@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("ssafer-dev");
  }

  @Test
  void fetchUserInfoThrowsInternalServerErrorWhenVerifiedEmailIsMissing() {
    given(githubOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:5173/oauth/github/callback"))
        .willReturn(new GithubOAuthTokenResponse("access-token", "bearer", "read:user user:email"));
    given(githubOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GithubOAuthUserResponse(101L, "ssafer-dev", "싸피맨"));
    given(githubOAuthApiClient.fetchUserEmails("access-token"))
        .willReturn(List.of(
            new GithubOAuthEmailResponse("unverified@ssafer.co.kr", true, false, null)
        ));

    assertThatThrownBy(() -> handler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
