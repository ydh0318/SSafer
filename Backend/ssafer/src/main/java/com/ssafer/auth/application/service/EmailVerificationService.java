package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.repository.EmailVerificationStore;
import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import com.ssafer.auth.domain.repository.VerificationEmailSender;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Duration;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationService {

  private static final int MAX_EMAIL_LENGTH = 255;

  private final EmailVerificationStore emailVerificationStore;
  private final VerificationCodeGenerator verificationCodeGenerator;
  private final VerificationEmailSender verificationEmailSender;
  private final UserRepository userRepository;
  private final Duration codeTtl;
  private final Duration cooldownTtl;
  private final Duration verifiedTtl;

  public EmailVerificationService(
      EmailVerificationStore emailVerificationStore,
      VerificationCodeGenerator verificationCodeGenerator,
      VerificationEmailSender verificationEmailSender,
      UserRepository userRepository,
      @Value("${EMAIL_VERIFICATION_CODE_TTL_SECONDS:300}") long codeTtlSeconds,
      @Value("${EMAIL_VERIFICATION_COOLDOWN_SECONDS:60}") long cooldownTtlSeconds,
      @Value("${EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS:1800}") long verifiedTtlSeconds
  ) {
    this.emailVerificationStore = emailVerificationStore;
    this.verificationCodeGenerator = verificationCodeGenerator;
    this.verificationEmailSender = verificationEmailSender;
    this.userRepository = userRepository;
    this.codeTtl = Duration.ofSeconds(codeTtlSeconds);
    this.cooldownTtl = Duration.ofSeconds(cooldownTtlSeconds);
    this.verifiedTtl = Duration.ofSeconds(verifiedTtlSeconds);
  }

  public void sendVerificationCode(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);

    // 이미 가입된 이메일에는 인증 코드를 다시 보내지 않는다.
    if (userRepository.existsByEmail(email)) {
      throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
    }

    String code = verificationCodeGenerator.generate();

    // cooldown 선점과 코드 저장을 한 번에 처리해서 동시에 들어온 요청을 막는다.
    boolean saved = emailVerificationStore.saveCodeIfCooldownNotActive(email, code, codeTtl, cooldownTtl);
    if (!saved) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT);
    }

    try {
      verificationEmailSender.sendVerificationCode(email, code);
    } catch (RuntimeException ex) {
      // 메일 발송이 실패하면 재시도할 수 있도록 코드와 cooldown을 함께 정리한다.
      emailVerificationStore.deleteCodeAndCooldown(email);
      throw new BusinessException(ErrorCode.EMAIL_DELIVERY_FAILED);
    }
  }

  public void verifyCode(String rawEmail, String rawCode) {
    String email = normalizeEmailOrThrow(rawEmail);
    String code = normalizeCodeOrThrow(rawCode);

    // 코드가 없으면 만료됐거나 아직 전송되지 않은 것으로 본다.
    String savedCode = emailVerificationStore.findCode(email)
        .orElseThrow(() -> new BusinessException(ErrorCode.EMAIL_VERIFICATION_CODE_INVALID));

    if (!savedCode.equals(code)) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_CODE_INVALID);
    }

    // 인증 성공 후 코드는 지우고, 회원가입에서 참조할 verified 상태만 남긴다.
    emailVerificationStore.deleteCode(email);
    emailVerificationStore.markVerified(email, verifiedTtl);
  }

  public boolean isVerifiedEmail(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);
    return emailVerificationStore.isVerified(email);
  }

  public void clearVerifiedEmail(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);
    emailVerificationStore.clearVerified(email);
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
