package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.PasswordResetCodeEmailSender;
import com.ssafer.auth.domain.repository.PasswordResetCodeStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.application.service.UserPasswordService;
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
  private UserPasswordService userPasswordService;
  private PasswordResetCodeService passwordResetCodeService;

  @BeforeEach
  void setUp() {
    passwordResetCodeStore = Mockito.mock(PasswordResetCodeStore.class);
    verificationCodeGenerator = Mockito.mock(VerificationCodeGenerator.class);
    passwordResetCodeEmailSender = Mockito.mock(PasswordResetCodeEmailSender.class);
    userRepository = Mockito.mock(UserRepository.class);
    userPasswordService = Mockito.mock(UserPasswordService.class);
    passwordResetCodeService = new PasswordResetCodeService(
        passwordResetCodeStore,
        verificationCodeGenerator,
        passwordResetCodeEmailSender,
        userRepository,
        userPasswordService,
        300,
        60,
        1800
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
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
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

    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
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
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
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
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
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
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
  }

  @Test
  void verifyCodeReturnsResetTokenWhenCodeMatches() {
    given(passwordResetCodeStore.findCode("user@ssafer.co.kr")).willReturn(Optional.of("123456"));

    String resetToken = passwordResetCodeService.verifyCode("USER@SSAFER.CO.KR", "123456");

    assertThat(resetToken).isNotBlank();
    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
    then(passwordResetCodeStore).should().saveResetToken(Mockito.eq("user@ssafer.co.kr"), Mockito.eq(resetToken), Mockito.any());
  }

  @Test
  void verifyCodeThrowsWhenCodeDoesNotMatch() {
    given(passwordResetCodeStore.findCode("user@ssafer.co.kr")).willReturn(Optional.of("654321"));
    given(passwordResetCodeStore.incrementCodeVerificationFailures(Mockito.eq("user@ssafer.co.kr"), Mockito.any()))
        .willReturn(1L);

    assertThatThrownBy(() -> passwordResetCodeService.verifyCode("user@ssafer.co.kr", "123456"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_CODE_INVALID);
  }

  @Test
  void verifyCodeDeletesCodeWhenFailuresAreExceeded() {
    given(passwordResetCodeStore.findCode("user@ssafer.co.kr")).willReturn(Optional.of("654321"));
    given(passwordResetCodeStore.incrementCodeVerificationFailures(Mockito.eq("user@ssafer.co.kr"), Mockito.any()))
        .willReturn(5L);

    assertThatThrownBy(() -> passwordResetCodeService.verifyCode("user@ssafer.co.kr", "123456"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED);

    then(passwordResetCodeStore).should().deleteCode("user@ssafer.co.kr");
    then(passwordResetCodeStore).should().clearCodeVerificationFailures("user@ssafer.co.kr");
  }

  @Test
  void completeResetDelegatesToUserPasswordServiceWhenTokenIsConsumed() {
    given(passwordResetCodeStore.consumeResetToken("reset-token-123"))
        .willReturn(Optional.of("user@ssafer.co.kr"));

    passwordResetCodeService.completeReset(" reset-token-123 ", "new-password123");

    then(userPasswordService).should().resetPassword("user@ssafer.co.kr", "new-password123");
  }

  @Test
  void completeResetThrowsWhenTokenIsMissing() {
    given(passwordResetCodeStore.consumeResetToken("reset-token-123")).willReturn(Optional.empty());

    assertThatThrownBy(() -> passwordResetCodeService.completeReset("reset-token-123", "new-password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PASSWORD_RESET_TOKEN_INVALID);
  }

  @Test
  void completeResetKeepsFailureFromPasswordUpdate() {
    given(passwordResetCodeStore.consumeResetToken("reset-token-123"))
        .willReturn(Optional.of("user@ssafer.co.kr"));
    Mockito.doThrow(new BusinessException(ErrorCode.INVALID_PARAMETER))
        .when(userPasswordService)
        .resetPassword("user@ssafer.co.kr", "new-password123");

    assertThatThrownBy(() -> passwordResetCodeService.completeReset("reset-token-123", "new-password123"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }
}
