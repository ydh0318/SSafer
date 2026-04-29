package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class UserPasswordServiceTest {

  private UserRepository userRepository;
  private PasswordEncoder passwordEncoder;
  private RefreshTokenStore refreshTokenStore;
  private AuthTokenProvider authTokenProvider;
  private UserPasswordService userPasswordService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    passwordEncoder = Mockito.mock(PasswordEncoder.class);
    refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    authTokenProvider = Mockito.mock(AuthTokenProvider.class);
    userPasswordService = new UserPasswordService(
        userRepository,
        passwordEncoder,
        refreshTokenStore,
        authTokenProvider
    );
  }

  @Test
  void changePasswordUpdatesPasswordHashForMember() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password123", "encoded-old-password")).willReturn(true);
    given(passwordEncoder.encode("new-password123")).willReturn("encoded-new-password");
    AuthTokenResult tokenResult = new AuthTokenResult(
        "new-access-token",
        Instant.parse("2026-04-29T07:00:00Z"),
        "new-refresh-token",
        Instant.parse("2026-05-13T07:00:00Z")
    );
    given(authTokenProvider.issueTokens(1L)).willReturn(tokenResult);

    AuthTokenResult result = userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "new-password123"
    );

    assertThat(result).isEqualTo(tokenResult);
    assertThat(user.getPasswordHash()).isEqualTo("encoded-new-password");
    then(refreshTokenStore).should().delete(1L);
    then(authTokenProvider).should().issueTokens(1L);
  }

  @Test
  void changePasswordThrowsForbiddenForGuest() {
    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.guest("guest-hash"),
        "password123",
        "new-password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void changePasswordThrowsInvalidCredentialsWhenCurrentPasswordDoesNotMatch() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));
    given(passwordEncoder.matches("wrong-password123", "encoded-old-password")).willReturn(false);

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "wrong-password123",
        "new-password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }

  @Test
  void changePasswordThrowsInvalidParameterWhenNewPasswordMatchesCurrentPassword() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password123", "encoded-old-password")).willReturn(true);

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void changePasswordThrowsInvalidParameterWhenNewPasswordIsBlank() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        " "
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void changePasswordThrowsInvalidParameterWhenNewPasswordIsTooShort() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "short"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void changePasswordThrowsNotFoundWhenUserDoesNotExist() {
    given(userRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "new-password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void changePasswordThrowsInvalidCredentialsWhenPasswordHashIsMissing() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", null);
    given(userRepository.findById(1L)).willReturn(Optional.of(user));

    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "new-password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }

  private User createUser(Long userId, String email, String displayName, String passwordHash) {
    User user = new User(email, displayName, passwordHash, AccountStatus.ACTIVE);
    ReflectionTestUtils.setField(user, "id", userId);
    return user;
  }
}
