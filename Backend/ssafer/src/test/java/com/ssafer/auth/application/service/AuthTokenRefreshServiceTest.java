package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AuthTokenRefreshServiceTest {

  private AuthTokenProvider authTokenProvider;
  private AuthTokenRefreshService authTokenRefreshService;

  @BeforeEach
  void setUp() {
    authTokenProvider = Mockito.mock(AuthTokenProvider.class);
    authTokenRefreshService = new AuthTokenRefreshService(authTokenProvider);
  }

  @Test
  void refreshReturnsReissuedTokensWhenRefreshTokenIsValid() {
    AuthTokenResult tokenResult = new AuthTokenResult(
        "new-access-token",
        Instant.parse("2026-04-29T00:00:00Z"),
        "new-refresh-token",
        Instant.parse("2026-05-13T00:00:00Z")
    );
    given(authTokenProvider.reissueTokens("refresh-token")).willReturn(tokenResult);

    AuthTokenResult result = authTokenRefreshService.refresh(" refresh-token ");

    assertThat(result).isEqualTo(tokenResult);
    then(authTokenProvider).should().reissueTokens("refresh-token");
  }

  @Test
  void refreshThrowsInvalidParameterWhenRefreshTokenIsBlank() {
    assertThatThrownBy(() -> authTokenRefreshService.refresh(" "))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }
}
