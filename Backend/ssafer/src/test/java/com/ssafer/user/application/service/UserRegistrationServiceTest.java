package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.application.service.EmailVerificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class UserRegistrationServiceTest {

  private EmailVerificationService emailVerificationService;
  private UserRepository userRepository;
  private PasswordEncoder passwordEncoder;
  private UserRegistrationService userRegistrationService;

  @BeforeEach
  void setUp() {
    emailVerificationService = Mockito.mock(EmailVerificationService.class);
    userRepository = Mockito.mock(UserRepository.class);
    passwordEncoder = new BCryptPasswordEncoder();
    userRegistrationService = new UserRegistrationService(emailVerificationService, userRepository, passwordEncoder);
  }

  @Test
  void registerStoresNormalizedValuesAndEncodedPassword() {
    User saved = new User("test@example.com", "Alice", "encoded", AccountStatus.ACTIVE);
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(true);
    given(userRepository.findByEmail("test@example.com")).willReturn(Optional.empty());
    given(userRepository.save(any(User.class))).willReturn(saved);

    userRegistrationService.register("  TEST@EXAMPLE.COM  ", "  Alice  ", "  password123  ");

    ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
    then(userRepository).should().save(userCaptor.capture());
    User captured = userCaptor.getValue();

    assertThat(captured.getEmail()).isEqualTo("test@example.com");
    assertThat(captured.getDisplayName()).isEqualTo("Alice");
    assertThat(captured.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
    assertThat(passwordEncoder.matches("  password123  ", captured.getPasswordHash())).isTrue();
    then(emailVerificationService).should().clearVerifiedEmail("test@example.com");
  }

  @Test
  void registerThrowsWhenEmailVerificationIsMissing() {
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(false);

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
  }

  @Test
  void registerThrowsDuplicateEmailWhenActiveEmailAlreadyExists() {
    User activeUser = new User("test@example.com", "Alice", "encoded", AccountStatus.ACTIVE);
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(true);
    given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(activeUser));

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_EMAIL);
  }

  @Test
  void registerReactivatesInactiveUserWithSameEmail() {
    User inactiveUser = new User("test@example.com", "Old Name", null, AccountStatus.INACTIVE);
    ReflectionTestUtils.setField(inactiveUser, "id", 1L);
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(true);
    given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(inactiveUser));

    Long userId = userRegistrationService.register("test@example.com", "Alice", "password123");

    assertThat(userId).isEqualTo(1L);
    assertThat(inactiveUser.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
    assertThat(inactiveUser.getDisplayName()).isEqualTo("Alice");
    assertThat(passwordEncoder.matches("password123", inactiveUser.getPasswordHash())).isTrue();
    then(userRepository).should(Mockito.never()).save(any(User.class));
    then(emailVerificationService).should().clearVerifiedEmail("test@example.com");
  }

  @Test
  void registerTranslatesUniqueConstraintViolationToDuplicateEmail() {
    User activeUser = new User("test@example.com", "Alice", "encoded", AccountStatus.ACTIVE);
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(true);
    given(userRepository.findByEmail("test@example.com"))
        .willReturn(Optional.empty())
        .willReturn(Optional.of(activeUser));
    given(userRepository.save(any(User.class))).willThrow(new DataIntegrityViolationException("duplicate"));

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_EMAIL);
  }

  @Test
  void registerRethrowsNonDuplicateDataIntegrityViolation() {
    given(emailVerificationService.isVerifiedEmail("test@example.com")).willReturn(true);
    given(userRepository.findByEmail("test@example.com"))
        .willReturn(Optional.empty())
        .willReturn(Optional.empty());
    given(userRepository.save(any(User.class))).willThrow(new DataIntegrityViolationException("other constraint"));

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void isEmailAvailableReturnsFalseWhenActiveEmailExists() {
    User activeUser = new User("test@example.com", "Alice", "encoded", AccountStatus.ACTIVE);
    given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(activeUser));

    boolean available = userRegistrationService.isEmailAvailable("TEST@example.com");

    assertThat(available).isFalse();
  }

  @Test
  void isEmailAvailableReturnsTrueWhenInactiveEmailExists() {
    User inactiveUser = new User("test@example.com", "Alice", null, AccountStatus.INACTIVE);
    given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(inactiveUser));

    boolean available = userRegistrationService.isEmailAvailable("TEST@example.com");

    assertThat(available).isTrue();
  }
}
