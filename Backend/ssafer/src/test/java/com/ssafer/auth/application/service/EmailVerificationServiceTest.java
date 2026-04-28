package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.EmailVerificationStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.auth.domain.repository.VerificationEmailSender;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class EmailVerificationServiceTest {

  private EmailVerificationStore emailVerificationStore;
  private VerificationCodeGenerator verificationCodeGenerator;
  private VerificationEmailSender verificationEmailSender;
  private UserRepository userRepository;
  private EmailVerificationService emailVerificationService;

  @BeforeEach
  void setUp() {
    emailVerificationStore = Mockito.mock(EmailVerificationStore.class);
    verificationCodeGenerator = Mockito.mock(VerificationCodeGenerator.class);
    verificationEmailSender = Mockito.mock(VerificationEmailSender.class);
    userRepository = Mockito.mock(UserRepository.class);
    emailVerificationService = new EmailVerificationService(
        emailVerificationStore,
        verificationCodeGenerator,
        verificationEmailSender,
        userRepository,
        300,
        60,
        1800
    );
  }

  @Test
  void sendVerificationCodeStoresCodeAndSendsMail() {
    given(userRepository.existsByEmail("user@ssafer.co.kr")).willReturn(false);
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(emailVerificationStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);

    emailVerificationService.sendVerificationCode("USER@SSAFER.CO.KR");

    then(emailVerificationStore).should().saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    );
    then(verificationEmailSender).should().sendVerificationCode("user@ssafer.co.kr", "123456");
  }

  @Test
  void sendVerificationCodeThrowsDuplicateEmailWhenUserAlreadyExists() {
    given(userRepository.existsByEmail("user@ssafer.co.kr")).willReturn(true);

    assertThatThrownBy(() -> emailVerificationService.sendVerificationCode("user@ssafer.co.kr"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_EMAIL);
  }

  @Test
  void sendVerificationCodeThrowsTooManyRequestsWhenCooldownReservationFails() {
    given(userRepository.existsByEmail("user@ssafer.co.kr")).willReturn(false);
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(emailVerificationStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(false);

    assertThatThrownBy(() -> emailVerificationService.sendVerificationCode("user@ssafer.co.kr"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT);
  }

  @Test
  void sendVerificationCodeClearsCodeAndCooldownWhenDeliveryFails() {
    given(userRepository.existsByEmail("user@ssafer.co.kr")).willReturn(false);
    given(verificationCodeGenerator.generate()).willReturn("123456");
    given(emailVerificationStore.saveCodeIfCooldownNotActive(
        Mockito.eq("user@ssafer.co.kr"),
        Mockito.eq("123456"),
        Mockito.any(),
        Mockito.any()
    )).willReturn(true);
    Mockito.doThrow(new RuntimeException("resend failed"))
        .when(verificationEmailSender)
        .sendVerificationCode("user@ssafer.co.kr", "123456");

    assertThatThrownBy(() -> emailVerificationService.sendVerificationCode("user@ssafer.co.kr"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.EMAIL_DELIVERY_FAILED);

    then(emailVerificationStore).should().deleteCodeAndCooldown("user@ssafer.co.kr");
  }

  @Test
  void verifyCodeMarksEmailAsVerifiedWhenCodeMatches() {
    given(emailVerificationStore.findCode("user@ssafer.co.kr")).willReturn(Optional.of("123456"));

    emailVerificationService.verifyCode("user@ssafer.co.kr", "123456");

    then(emailVerificationStore).should().deleteCode("user@ssafer.co.kr");
    then(emailVerificationStore).should().markVerified(Mockito.eq("user@ssafer.co.kr"), Mockito.any());
  }

  @Test
  void verifyCodeThrowsWhenCodeDoesNotMatch() {
    given(emailVerificationStore.findCode("user@ssafer.co.kr")).willReturn(Optional.of("654321"));

    assertThatThrownBy(() -> emailVerificationService.verifyCode("user@ssafer.co.kr", "123456"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.EMAIL_VERIFICATION_CODE_INVALID);
  }
}
