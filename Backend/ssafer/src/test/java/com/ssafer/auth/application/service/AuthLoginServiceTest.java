package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthLoginServiceTest {

  private UserRepository userRepository;
  private PasswordEncoder passwordEncoder;
  private AuthTokenProvider authTokenProvider;
  private AuthLoginService authLoginService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    passwordEncoder = new BCryptPasswordEncoder();
    authTokenProvider = Mockito.mock(AuthTokenProvider.class);
    authLoginService = new AuthLoginService(userRepository, passwordEncoder, authTokenProvider);
  }

  @Test
  void loginReturnsTokensWhenCredentialsAreValid() {
    User user = new User(
        "user@ssafer.co.kr",
        "ssafer",
        passwordEncoder.encode("password123!"),
        AccountStatus.ACTIVE
    );
    AuthTokenResult tokenResult = new AuthTokenResult(
        "access-token",
        Instant.parse("2026-04-29T00:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-13T00:00:00Z")
    );
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));
    given(authTokenProvider.issueTokens(user.getId())).willReturn(tokenResult);

    AuthTokenResult result = authLoginService.login("USER@SSAFER.CO.KR", "password123!");

    assertThat(result).isEqualTo(tokenResult);
    then(authTokenProvider).should().issueTokens(user.getId());
  }

  @Test
  void loginThrowsInvalidCredentialsWhenPasswordIsWrong() {
    User user = new User(
        "user@ssafer.co.kr",
        "ssafer",
        passwordEncoder.encode("password123!"),
        AccountStatus.ACTIVE
    );
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "wrong-password"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }

  @Test
  void loginThrowsInvalidCredentialsWhenAccountIsInactive() {
    User user = new User(
        "user@ssafer.co.kr",
        "ssafer",
        passwordEncoder.encode("password123!"),
        AccountStatus.INACTIVE
    );
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }

  @Test
  void loginThrowsInvalidCredentialsWhenPasswordHashIsMissing() {
    User user = new User("user@ssafer.co.kr", "ssafer", null, AccountStatus.ACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }
}
