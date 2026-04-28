package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
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
  void loginThrowsInvalidCredentialsWhenPasswordHashIsMissing() {
    User user = new User("user@ssafer.co.kr", "ssafer", null, AccountStatus.ACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }
}
