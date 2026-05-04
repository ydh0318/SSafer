package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.PasswordResetCodeEmailSender;
import com.ssafer.auth.domain.repository.PasswordResetCodeStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class PasswordResetCodeServiceTest {

  private PasswordResetCodeStore passwordResetCodeStore;
  private VerificationCodeGenerator verificationCodeGenerator;
  private PasswordResetCodeEmailSender passwordResetCodeEmailSender;
  private UserRepository userRepository;
  private PasswordResetCodeService passwordResetCodeService;

  @BeforeEach
  void setUp() {
    passwordResetCodeStore = Mockito.mock(PasswordResetCodeStore.class);
    verificationCodeGenerator = Mockito.mock(VerificationCodeGenerator.class);
    passwordResetCodeEmailSender = Mockito.mock(PasswordResetCodeEmailSender.class);
    userRepository = Mockito.mock(UserRepository.class);
    passwordResetCodeService = new PasswordResetCodeService(
        passwordResetCodeStore,
        verificationCodeGenerator,
        passwordResetCodeEmailSender,
        userRepository,
        300,
        60
    );
  }

  @Test
  void sendResetCodeStoresCodeAndSendsMailForEligibleUser() {
    User user = new User("user@ssafer.co.kr", "tester", "encoded-password", AccountStatus.ACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);

    passwordResetCodeService.sendResetCode("USER@SSAFER.CO.KR");

    then(passwordResetCodeStore).should().saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    );
    then(passwordResetCodeEmailSender).should().sendPasswordResetCode("user@ssafer.co.kr", "123456");
  }

  @Test
  void sendResetCodeKeepsCooldownBehaviorWhenUserDoesNotExist() {
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.empty());
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");

    then(passwordResetCodeStore).should().saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    );
    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeEmailSender).shouldHaveNoInteractions();
  }

  @Test
  void sendResetCodeKeepsCooldownBehaviorWhenUserIsInactive() {
    User user = new User("user@ssafer.co.kr", "tester", "encoded-password", AccountStatus.INACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");

    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeEmailSender).shouldHaveNoInteractions();
  }

  @Test
  void sendResetCodeKeepsCooldownBehaviorWhenPasswordLoginIsUnavailable() {
    User user = new User("user@ssafer.co.kr", "tester", null, AccountStatus.ACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");

    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeEmailSender).shouldHaveNoInteractions();
  }

  @Test
  void sendResetCodeThrowsTooManyRequestsWhenCooldownReservationFails() {
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(false);

    assertThatThrownBy(() -> passwordResetCodeService.sendResetCode("user@ssafer.co.kr"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT);
  }

  @Test
  void sendResetCodeHidesDeliveryFailureAndDeletesCode() {
    User user = new User("user@ssafer.co.kr", "tester", "encoded-password", AccountStatus.ACTIVE);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(user));
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(passwordResetCodeStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);
    Mockito.doThrow(new RuntimeException("resend failed"))
        .when(passwordResetCodeEmailSender)
        .sendPasswordResetCode("user@ssafer.co.kr", "123456");

    passwordResetCodeService.sendResetCode("user@ssafer.co.kr");

    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
  }
}
