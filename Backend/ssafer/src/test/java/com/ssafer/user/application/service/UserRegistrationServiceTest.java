package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserRegistrationServiceTest {

  private UserRepository userRepository;
  private PasswordEncoder passwordEncoder;
  private UserRegistrationService userRegistrationService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    passwordEncoder = new BCryptPasswordEncoder();
    userRegistrationService = new UserRegistrationService(userRepository, passwordEncoder);
  }

  @Test
  void registerStoresNormalizedValuesAndEncodedPassword() {
    User saved = new User("test@example.com", "Alice", "encoded", AccountStatus.ACTIVE);
    given(userRepository.existsByEmail("test@example.com")).willReturn(false);
    given(userRepository.save(any(User.class))).willReturn(saved);

    userRegistrationService.register("  TEST@EXAMPLE.COM  ", "  Alice  ", "  password123  ");

    ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
    then(userRepository).should().save(userCaptor.capture());
    User captured = userCaptor.getValue();

    assertThat(captured.getEmail()).isEqualTo("test@example.com");
    assertThat(captured.getDisplayName()).isEqualTo("Alice");
    assertThat(captured.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
    assertThat(passwordEncoder.matches("  password123  ", captured.getPasswordHash())).isTrue();
  }

  @Test
  void registerThrowsDuplicateEmailWhenEmailAlreadyExists() {
    given(userRepository.existsByEmail("test@example.com")).willReturn(true);

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_EMAIL);
  }

  @Test
  void registerTranslatesUniqueConstraintViolationToDuplicateEmail() {
    given(userRepository.existsByEmail("test@example.com")).willReturn(false, true);
    given(userRepository.save(any(User.class))).willThrow(new DataIntegrityViolationException("duplicate"));

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_EMAIL);
  }

  @Test
  void registerRethrowsNonDuplicateDataIntegrityViolation() {
    given(userRepository.existsByEmail("test@example.com")).willReturn(false, false);
    given(userRepository.save(any(User.class))).willThrow(new DataIntegrityViolationException("other constraint"));

    assertThatThrownBy(() -> userRegistrationService.register("test@example.com", "Alice", "password123"))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void isEmailAvailableReturnsFalseWhenEmailExists() {
    given(userRepository.existsByEmail("test@example.com")).willReturn(true);

    boolean available = userRegistrationService.isEmailAvailable("TEST@example.com");

    assertThat(available).isFalse();
  }
}
