package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.ssafer.auth.domain.repository.PasswordResetCodeEmailSender;
import com.ssafer.auth.domain.repository.PasswordResetCodeStore;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.auth.infrastructure.token.JwtAuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import com.ssafer.user.domain.repository.UserSocialAccountRepository;
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

class PasswordResetFlowTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";
  private static final long ACCESS_TOKEN_EXPIRES_SECONDS = 900;
  private static final long REFRESH_TOKEN_EXPIRES_SECONDS = 1209600;

  private UserRepository userRepository;
  private VerificationCodeGenerator verificationCodeGenerator;
  private CapturingPasswordResetCodeEmailSender passwordResetCodeEmailSender;
  private InMemoryPasswordResetCodeStore passwordResetCodeStore;
  private InMemoryRefreshTokenStore refreshTokenStore;
  private AuthLoginService authLoginService;
  private AuthTokenRefreshService authTokenRefreshService;
  private UserPasswordService userPasswordService;
  private PasswordResetCodeService passwordResetCodeService;
  private UserSocialAccountRepository userSocialAccountRepository;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    userSocialAccountRepository = Mockito.mock(UserSocialAccountRepository.class);
    verificationCodeGenerator = Mockito.mock(VerificationCodeGenerator.class);
    passwordResetCodeEmailSender = new CapturingPasswordResetCodeEmailSender();
    passwordResetCodeStore = new InMemoryPasswordResetCodeStore();
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

    authLoginService = new AuthLoginService(userRepository, passwordEncoder, authTokenProvider);
    authTokenRefreshService = new AuthTokenRefreshService(authTokenProvider);
    userPasswordService = new UserPasswordService(
        userRepository,
        userSocialAccountRepository,
        passwordEncoder,
        refreshTokenStore,
        authTokenProvider
    );
    passwordResetCodeService = new PasswordResetCodeService(
        passwordResetCodeStore,
        verificationCodeGenerator,
        passwordResetCodeEmailSender,
        userRepository,
        userPasswordService,
        300,
        0,
        1800
    );

    configureStatefulUserRepositoryMock();
  }

  @Test
  void passwordResetFlowResetsPasswordAndInvalidatesPreviousRefreshToken() {
    userRepository.save(new User(
        "user@ssafer.co.kr",
        "Alice",
        new BCryptPasswordEncoder().encode("password123!"),
        AccountStatus.ACTIVE
    ));
    given(verificationCodeGenerator.generate()).willReturn("123456");

    AuthTokenResult loginResult = authLoginService.login("user@ssafer.co.kr", "password123!");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    String resetToken = passwordResetCodeService.verifyCode("user@ssafer.co.kr", passwordResetCodeEmailSender.lastCode());
    passwordResetCodeService.completeReset(resetToken, "new-password123!");

    assertThatThrownBy(() -> authLoginService.login("user@ssafer.co.kr", "password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
    assertThatThrownBy(() -> authTokenRefreshService.refresh(loginResult.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);

    AuthTokenResult newLoginResult = authLoginService.login("user@ssafer.co.kr", "new-password123!");
    assertThat(newLoginResult.accessToken()).isNotBlank();
    assertThat(newLoginResult.refreshToken()).isNotBlank();
  }

  @Test
  void passwordResetFlowKeepsExistingTokenUntilNewCodeIsVerified() {
    userRepository.save(new User(
        "user@ssafer.co.kr",
        "Alice",
        new BCryptPasswordEncoder().encode("password123!"),
        AccountStatus.ACTIVE
    ));
    given(verificationCodeGenerator.generate()).willReturn("111111", "222222");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    String firstResetToken = passwordResetCodeService.verifyCode("user@ssafer.co.kr", passwordResetCodeEmailSender.lastCode());

    // 새 코드 발송만으로는 이미 발급된 재설정 토큰을 무효화하지 않는다.
    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    passwordResetCodeService.completeReset(firstResetToken, "new-password123!");

    AuthTokenResult newLoginResult = authLoginService.login("user@ssafer.co.kr", "new-password123!");
    assertThat(newLoginResult.accessToken()).isNotBlank();
  }

  @Test
  void passwordResetFlowReplacesPreviousTokenWhenNewCodeIsVerified() {
    userRepository.save(new User(
        "user@ssafer.co.kr",
        "Alice",
        new BCryptPasswordEncoder().encode("password123!"),
        AccountStatus.ACTIVE
    ));
    given(verificationCodeGenerator.generate()).willReturn("111111", "222222");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    String firstResetToken = passwordResetCodeService.verifyCode("user@ssafer.co.kr", passwordResetCodeEmailSender.lastCode());

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    String secondResetToken = passwordResetCodeService.verifyCode("user@ssafer.co.kr", passwordResetCodeEmailSender.lastCode());

    assertThatThrownBy(() -> passwordResetCodeService.completeReset(firstResetToken, "new-password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_TOKEN_INVALID);

    passwordResetCodeService.completeReset(secondResetToken, "new-password123!");

    AuthTokenResult newLoginResult = authLoginService.login("user@ssafer.co.kr", "new-password123!");
    assertThat(newLoginResult.accessToken()).isNotBlank();
  }

  @Test
  void passwordResetFlowRejectsReusedToken() {
    userRepository.save(new User(
        "user@ssafer.co.kr",
        "Alice",
        new BCryptPasswordEncoder().encode("password123!"),
        AccountStatus.ACTIVE
    ));
    given(verificationCodeGenerator.generate()).willReturn("123456");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");
    String resetToken = passwordResetCodeService.verifyCode("user@ssafer.co.kr", passwordResetCodeEmailSender.lastCode());
    passwordResetCodeService.completeReset(resetToken, "new-password123!");

    assertThatThrownBy(() -> passwordResetCodeService.completeReset(resetToken, "another-password123!"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_TOKEN_INVALID);
  }

  @Test
  void passwordResetFlowExpiresCodeAfterTooManyVerificationFailures() {
    userRepository.save(new User(
        "user@ssafer.co.kr",
        "Alice",
        new BCryptPasswordEncoder().encode("password123!"),
        AccountStatus.ACTIVE
    ));
    given(verificationCodeGenerator.generate()).willReturn("123456");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");

    for (int attempt = 0; attempt < 4; attempt++) {
      assertThatThrownBy(() -> passwordResetCodeService.verifyCode("user@ssafer.co.kr", "000000"))
          .isInstanceOf(BusinessException.class)
          .extracting(ex -> ((BusinessException) ex).getErrorCode())
          .isEqualTo(ErrorCode.PASSWORD_RESET_CODE_INVALID);
    }

    assertThatThrownBy(() -> passwordResetCodeService.verifyCode("user@ssafer.co.kr", "000000"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED);

    assertThatThrownBy(() -> passwordResetCodeService.verifyCode("user@ssafer.co.kr", "123456"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_CODE_INVALID);
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
          if (user.getId() == null) {
            ReflectionTestUtils.setField(user, "id", sequence.getAndIncrement());
          }
          usersByEmail.put(user.getEmail(), user);
          usersById.put(user.getId(), user);
          return user;
        });
  }

  private static class CapturingPasswordResetCodeEmailSender implements PasswordResetCodeEmailSender {

    private String lastCode;

    @Override
    public void sendPasswordResetCode(String email, String code) {
      this.lastCode = code;
    }

    String lastCode() {
      return lastCode;
    }
  }

  private static class InMemoryPasswordResetCodeStore implements PasswordResetCodeStore {

    private final Map<String, String> codesByEmail = new HashMap<>();
    private final Map<String, String> resetTokensByEmail = new HashMap<>();
    private final Map<String, String> emailsByResetToken = new HashMap<>();
    private final Map<String, Boolean> cooldowns = new HashMap<>();
    private final Map<String, Long> verifyFailuresByEmail = new HashMap<>();

    @Override
    public boolean saveCodeIfCooldownNotActive(String email, String code, Duration codeTtl, Duration cooldownTtl) {
      // 플로우 테스트에서는 cooldown 0초를 주입해 재발송 시나리오를 단순하게 검증한다.
      if (!cooldownTtl.isZero() && Boolean.TRUE.equals(cooldowns.get(email))) {
        return false;
      }
      if (!cooldownTtl.isZero()) {
        cooldowns.put(email, true);
      }
      codesByEmail.put(email, code);
      return true;
    }

    @Override
    public Optional<String> findCode(String email) {
      return Optional.ofNullable(codesByEmail.get(email));
    }

    @Override
    public void deleteCode(String email) {
      codesByEmail.remove(email);
    }

    @Override
    public void deleteCodeAndCooldown(String email) {
      codesByEmail.remove(email);
      cooldowns.remove(email);
    }

    @Override
    public void saveResetToken(String email, String resetToken, Duration resetTokenTtl) {
      String previousToken = resetTokensByEmail.put(email, resetToken);
      if (previousToken != null) {
        emailsByResetToken.remove(previousToken);
      }
      emailsByResetToken.put(resetToken, email);
    }

    @Override
    public Optional<String> consumeResetToken(String resetToken) {
      String email = emailsByResetToken.remove(resetToken);
      if (email == null) {
        return Optional.empty();
      }
      resetTokensByEmail.remove(email);
      return Optional.of(email);
    }

    @Override
    public long incrementCodeVerificationFailures(String email, Duration failureTtl) {
      long failures = verifyFailuresByEmail.getOrDefault(email, 0L) + 1L;
      verifyFailuresByEmail.put(email, failures);
      return failures;
    }

    @Override
    public void clearCodeVerificationFailures(String email) {
      verifyFailuresByEmail.remove(email);
    }
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
