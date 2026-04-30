package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AuthLogoutServiceTest {

  private AuthTokenProvider authTokenProvider;
  private AuthLogoutService authLogoutService;

  @BeforeEach
  void setUp() {
    authTokenProvider = Mockito.mock(AuthTokenProvider.class);
    authLogoutService = new AuthLogoutService(authTokenProvider);
  }

  @Test
  void logoutRevokesRefreshTokenWhenRequestIsValid() {
    authLogoutService.logout(" refresh-token ");

    then(authTokenProvider).should().revokeRefreshToken("refresh-token");
  }

  @Test
  void logoutThrowsInvalidParameterWhenRefreshTokenIsBlank() {
    assertThatThrownBy(() -> authLogoutService.logout(" "))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }
}
