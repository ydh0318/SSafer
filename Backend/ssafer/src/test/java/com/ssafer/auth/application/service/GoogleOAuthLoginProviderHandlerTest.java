package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthApiClient;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthTokenResponse;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthUserInfoResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class GoogleOAuthLoginProviderHandlerTest {

  private GoogleOAuthApiClient googleOAuthApiClient;
  private GoogleOAuthLoginProviderHandler handler;

  @BeforeEach
  void setUp() {
    googleOAuthApiClient = Mockito.mock(GoogleOAuthApiClient.class);
    handler = new GoogleOAuthLoginProviderHandler(googleOAuthApiClient);
  }

  @Test
  void fetchUserInfoExchangesCodeAndReturnsGoogleUserInfo() {
    given(googleOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:3000/oauth/google/callback"))
        .willReturn(new GoogleOAuthTokenResponse("access-token", "Bearer", "id-token", 3600L, "openid email profile"));
    given(googleOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GoogleOAuthUserInfoResponse("google-user-123", "user@ssafer.co.kr", true, "싸피맨"));

    OAuthProviderUserInfo result = handler.fetchUserInfo("auth-code", "http://localhost:3000/oauth/google/callback");

    assertThat(result.provider()).isEqualTo(OAuthProvider.GOOGLE);
    assertThat(result.providerUserId()).isEqualTo("google-user-123");
    assertThat(result.email()).isEqualTo("user@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("싸피맨");
  }

  @Test
  void fetchUserInfoThrowsInternalServerErrorWhenGoogleResponseIsMissingRequiredFields() {
    given(googleOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:3000/oauth/google/callback"))
        .willReturn(new GoogleOAuthTokenResponse("access-token", "Bearer", "id-token", 3600L, "openid email profile"));
    given(googleOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GoogleOAuthUserInfoResponse("", "", true, null));

    assertThatThrownBy(() -> handler.fetchUserInfo("auth-code", "http://localhost:3000/oauth/google/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  @Test
  void fetchUserInfoThrowsInternalServerErrorWhenGoogleEmailIsNotVerified() {
    given(googleOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost:3000/oauth/google/callback"))
        .willReturn(new GoogleOAuthTokenResponse("access-token", "Bearer", "id-token", 3600L, "openid email profile"));
    given(googleOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GoogleOAuthUserInfoResponse("google-user-123", "user@ssafer.co.kr", false, "싸피맨"));

    assertThatThrownBy(() -> handler.fetchUserInfo("auth-code", "http://localhost:3000/oauth/google/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
