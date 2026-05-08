package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

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
  void fetchUserInfoThrowsUnauthorizedWhenGoogleEmailIsNotVerified() {
    given(googleOAuthApiClient.exchangeAuthorizationCode("auth-code", "http://localhost/callback"))
        .willReturn(new GoogleOAuthTokenResponse("access-token", "Bearer", null, 3600L, "openid email profile"));
    given(googleOAuthApiClient.fetchUserInfo("access-token"))
        .willReturn(new GoogleOAuthUserInfoResponse("google-123", "user@ssafer.co.kr", false, "Alice"));

    assertThatThrownBy(() -> handler.fetchUserInfo("auth-code", "http://localhost/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
  }
}
