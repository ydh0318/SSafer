package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.repository.PasswordResetCodeEmailSender;
import com.ssafer.auth.domain.repository.PasswordResetCodeStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Duration;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetCodeService {

  private static final Logger log = LoggerFactory.getLogger(PasswordResetCodeService.class);
  private static final int MAX_EMAIL_LENGTH = 255;

  private final PasswordResetCodeStore passwordResetCodeStore;
  private final VerificationCodeGenerator verificationCodeGenerator;
  private final PasswordResetCodeEmailSender passwordResetCodeEmailSender;
  private final UserRepository userRepository;
  private final UserPasswordService userPasswordService;
  private final Duration codeTtl;
  private final Duration cooldownTtl;
  private final Duration verifiedTtl;

  public PasswordResetCodeService(
      PasswordResetCodeStore passwordResetCodeStore,
      VerificationCodeGenerator verificationCodeGenerator,
      PasswordResetCodeEmailSender passwordResetCodeEmailSender,
      UserRepository userRepository,
      UserPasswordService userPasswordService,
      @Value("${PASSWORD_RESET_CODE_TTL_SECONDS:300}") long codeTtlSeconds,
      @Value("${PASSWORD_RESET_COOLDOWN_SECONDS:60}") long cooldownTtlSeconds,
      @Value("${PASSWORD_RESET_VERIFIED_TTL_SECONDS:1800}") long verifiedTtlSeconds
  ) {
    this.passwordResetCodeStore = passwordResetCodeStore;
    this.verificationCodeGenerator = verificationCodeGenerator;
    this.passwordResetCodeEmailSender = passwordResetCodeEmailSender;
    this.userRepository = userRepository;
    this.userPasswordService = userPasswordService;
    this.codeTtl = Duration.ofSeconds(codeTtlSeconds);
    this.cooldownTtl = Duration.ofSeconds(cooldownTtlSeconds);
    this.verifiedTtl = Duration.ofSeconds(verifiedTtlSeconds);
  }

  public void sendResetCode(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);
    String code = verificationCodeGenerator.generate();

    // 계정 존재 여부가 응답 패턴으로 드러나지 않도록 cooldown 예약은 항상 먼저 수행한다.
    boolean saved = passwordResetCodeStore.saveCodeIfCooldownNotActive(email, code, codeTtl, cooldownTtl);
    if (!saved) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT);
    }

    // 비밀번호 로그인 대상이 아니면 메일은 보내지 않고 코드만 정리한다.
    User user = userRepository.findByEmail(email)
        .filter(this::isEligibleForPasswordReset)
        .orElse(null);
    if (user == null) {
      passwordResetCodeStore.deleteCode(email);
      return;
    }

    try {
      passwordResetCodeEmailSender.sendPasswordResetCode(email, code);
    } catch (RuntimeException ex) {
      // 공개 API에서는 발송 장애도 계정 존재 여부 단서가 되지 않도록 숨기고 로그만 남긴다.
      log.error("Password reset email delivery failed for email={}", email, ex);
      passwordResetCodeStore.deleteCode(email);
    }
  }

  public void verifyCode(String rawEmail, String rawCode) {
    String email = normalizeEmailOrThrow(rawEmail);
    String code = normalizeCodeOrThrow(rawCode);

    String savedCode = passwordResetCodeStore.findCode(email)
        .orElseThrow(() -> new BusinessException(ErrorCode.PASSWORD_RESET_CODE_INVALID));

    if (!savedCode.equals(code)) {
      throw new BusinessException(ErrorCode.PASSWORD_RESET_CODE_INVALID);
    }

    // 코드 검증이 끝나면 코드는 지우고, 재설정 완료 API에서 확인할 검증 상태를 남긴다.
    passwordResetCodeStore.deleteCode(email);
    passwordResetCodeStore.markVerified(email, verifiedTtl);
  }

  public void completeReset(String rawEmail, String rawNewPassword) {
    String email = normalizeEmailOrThrow(rawEmail);

    if (!passwordResetCodeStore.isVerified(email)) {
      throw new BusinessException(ErrorCode.PASSWORD_RESET_VERIFICATION_REQUIRED);
    }

    userPasswordService.resetPassword(email, rawNewPassword);
    passwordResetCodeStore.clearVerified(email);
  }

  private boolean isEligibleForPasswordReset(User user) {
    return user.isActive() && user.getPasswordHash() != null && !user.getPasswordHash().isBlank();
  }

  private String normalizeEmailOrThrow(String rawEmail) {
    if (rawEmail == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawEmail.trim().toLowerCase(Locale.ROOT);
    if (normalized.isEmpty() || normalized.length() > MAX_EMAIL_LENGTH || !normalized.contains("@")) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }

  private String normalizeCodeOrThrow(String rawCode) {
    if (rawCode == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawCode.trim();
    if (!normalized.matches("\\d{6}")) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }
}
