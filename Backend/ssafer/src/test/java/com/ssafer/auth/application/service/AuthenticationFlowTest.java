package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.auth.infrastructure.token.JwtAuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.application.service.UserRegistrationService;
import com.ssafer.user.application.service.UserWithdrawalService;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AuthenticationFlowTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";
  private static final long ACCESS_TOKEN_EXPIRES_SECONDS = 900;
  private static final long REFRESH_TOKEN_EXPIRES_SECONDS = 1209600;

  private EmailVerificationService emailVerificationService;
  private UserRepository userRepository;
  private InMemoryRefreshTokenStore refreshTokenStore;
  private UserRegistrationService userRegistrationService;
  private UserWithdrawalService userWithdrawalService;
  private AuthLoginService authLoginService;
  private AuthTokenRefreshService authTokenRefreshService;
  private AuthLogoutService authLogoutService;

  @BeforeEach
  void setUp() {
    emailVerificationService = Mockito.mock(EmailVerificationService.class);
    userRepository = Mockito.mock(UserRepository.class);
    refreshTokenStore = new InMemoryRefreshTokenStore();

    PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    JwtAuthTokenProvider authTokenProvider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
    );

    userRegistrationService = new UserRegistrationService(
        emailVerificationService,
        userRepository,
        passwordEncoder
    );
    userWithdrawalService = new UserWithdrawalService(userRepository, refreshTokenStore);
    authLoginService = new AuthLoginService(userRepository, passwordEncoder, authTokenProvider);
    authTokenRefreshService = new AuthTokenRefreshService(authTokenProvider);
    authLogoutService = new AuthLogoutService(authTokenProvider);

    configureStatefulUserRepositoryMock();
  }

  @Test
  void memberLifecycleFlowRegistersLogsInRefreshesAndLogsOut() {
    given(emailVerificationService.isVerifiedEmail("user@ssafer.co.kr")).willReturn(true);

    Long userId = userRegistrationService.register(
        "user@ssafer.co.kr",
        "Alice",
        "password123!"
    );
    AuthTokenResult loginResult = authLoginService.login("user@ssafer.co.kr", "password123!");
    AuthTokenResult refreshResult = authTokenRefreshService.refresh(loginResult.refreshToken());
    authLogoutService.logout(refreshResult.refreshToken());

    assertThat(userId).isEqualTo(1L);
    assertThat(loginResult.accessToken()).isNotBlank();
    assertThat(loginResult.refreshToken()).isNotBlank();
    assertThat(refreshResult.accessToken()).isNotBlank();
    assertThat(refreshResult.refreshToken()).isNotBlank();
    assertThat(refreshResult.refreshToken()).isNotEqualTo(loginResult.refreshToken());
    assertThat(refreshTokenStore.findByUserId(userId)).isEmpty();
    then(emailVerificationService).should().clearVerifiedEmail("user@ssafer.co.kr");
  }

  @Test
  void memberLifecycleFlowRejectsRefreshAfterLogout() {
    given(emailVerificationService.isVerifiedEmail("user@ssafer.co.kr")).willReturn(true);

    Long userId = userRegistrationService.register(
        "user@ssafer.co.kr",
        "Alice",
        "password123!"
    );
    AuthTokenResult loginResult = authLoginService.login("user@ssafer.co.kr", "password123!");
    authLogoutService.logout(loginResult.refreshToken());

    assertThatThrownBy(() -> authTokenRefreshService.refresh(loginResult.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
    assertThat(refreshTokenStore.findByUserId(userId)).isEmpty();
  }

  @Test
  void memberLifecycleFlowWithdrawsAndReactivatesSameAccountOnReregistration() {
    given(emailVerificationService.isVerifiedEmail("user@ssafer.co.kr")).willReturn(true);

    Long firstUserId = userRegistrationService.register(
        "user@ssafer.co.kr",
        "Alice",
        "password123!"
    );
    AuthTokenResult firstLoginResult = authLoginService.login("user@ssafer.co.kr", "password123!");

    userWithdrawalService.withdrawCurrentUser(AuthenticatedActor.member(firstUserId));

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
    assertThat(refreshTokenStore.findByUserId(firstUserId)).isEmpty();

    Long reactivatedUserId = userRegistrationService.register(
        "user@ssafer.co.kr",
        "Alice Rejoined",
        "new-password123!"
    );
    AuthTokenResult secondLoginResult = authLoginService.login("user@ssafer.co.kr", "new-password123!");

    assertThat(reactivatedUserId).isEqualTo(firstUserId);
    assertThat(secondLoginResult.accessToken()).isNotBlank();
    assertThat(secondLoginResult.refreshToken()).isNotBlank();
    assertThat(secondLoginResult.refreshToken()).isNotEqualTo(firstLoginResult.refreshToken());

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
  }

  private void configureStatefulUserRepositoryMock() {
    Map<String, User> usersByEmail = new HashMap<>();
    Map<Long, User> usersById = new HashMap<>();
    AtomicLong sequence = new AtomicLong(1L);

    given(userRepository.existsByEmail(any(String.class)))
        .willAnswer(invocation -> usersByEmail.containsKey(invocation.getArgument(0)));
    given(userRepository.findByEmail(any(String.class)))
        .willAnswer(invocation -> Optional.ofNullable(usersByEmail.get(invocation.getArgument(0))));
    given(userRepository.findByIdAndAccountStatus(any(Long.class), any(AccountStatus.class)))
        .willAnswer(invocation -> {
          Long userId = invocation.getArgument(0);
          AccountStatus status = invocation.getArgument(1);
          User user = usersById.get(userId);
          if (user == null || user.getAccountStatus() != status) {
            return Optional.empty();
          }
          return Optional.of(user);
        });
    given(userRepository.existsByIdAndAccountStatus(any(Long.class), any(AccountStatus.class)))
        .willAnswer(invocation -> {
          Long userId = invocation.getArgument(0);
          AccountStatus status = invocation.getArgument(1);
          User user = usersById.get(userId);
          return user != null && user.getAccountStatus() == status;
        });
    given(userRepository.save(any(User.class)))
        .willAnswer(invocation -> {
          User user = invocation.getArgument(0);
          Long userId = sequence.getAndIncrement();
          ReflectionTestUtils.setField(user, "id", userId);
          usersByEmail.put(user.getEmail(), user);
          usersById.put(userId, user);
          return user;
        });
    given(userRepository.saveAndFlush(any(User.class)))
        .willAnswer(invocation -> {
          User user = invocation.getArgument(0);
          if (user.getId() == null) {
            Long userId = sequence.getAndIncrement();
            ReflectionTestUtils.setField(user, "id", userId);
            usersById.put(userId, user);
          } else {
            usersById.put(user.getId(), user);
          }
          usersByEmail.put(user.getEmail(), user);
          return user;
        });
  }

  private static class InMemoryRefreshTokenStore implements RefreshTokenStore {

    private final Map<Long, String> values = new HashMap<>();

    @Override
    public void save(Long userId, String refreshToken, Duration ttl) {
      values.put(userId, refreshToken);
    }

    @Override
    public Optional<String> findByUserId(Long userId) {
      return Optional.ofNullable(values.get(userId));
    }

    @Override
    public void delete(Long userId) {
      values.remove(userId);
    }
  }
}
