package com.ssafer.user.application.service;

import com.ssafer.auth.application.service.EmailVerificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserRegistrationService {

  private static final int MAX_EMAIL_LENGTH = 255;
  private static final int MAX_DISPLAY_NAME_LENGTH = 100;
  private static final int MAX_PASSWORD_LENGTH = 72;

  private final EmailVerificationService emailVerificationService;
  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public UserRegistrationService(
      EmailVerificationService emailVerificationService,
      UserRepository userRepository,
      PasswordEncoder passwordEncoder
  ) {
    this.emailVerificationService = emailVerificationService;
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public Long register(String rawEmail, String rawDisplayName, String rawPassword) {
    // 가입과 재가입 모두 동일한 정규화 규칙을 써야 중복 판단이 흔들리지 않는다.
    String email = normalizeEmailOrThrow(rawEmail);
    String displayName = normalizeDisplayNameOrThrow(rawDisplayName);
    String password = normalizePasswordOrThrow(rawPassword);

    if (!emailVerificationService.isVerifiedEmail(email)) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
    }

    User user = userRepository.findByEmail(email).orElse(null);
    if (user != null) {
      if (user.getAccountStatus() != AccountStatus.INACTIVE) {
        throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
      }

      // 탈퇴한 동일 이메일 계정은 새 row를 만들지 않고 기존 계정을 되살린다.
      ensureDisplayNameAvailable(displayName);

      try {
        user.reactivate(displayName, passwordEncoder.encode(password));
        userRepository.flush();
        emailVerificationService.clearVerifiedEmail(email);
        return user.getId();
      } catch (DataIntegrityViolationException ex) {
        throw UserConstraintViolationSupport.translateRegistrationException(ex);
      }
    }

    // 활성 사용자 닉네임 중복은 DB 저장 전에 한 번 빠르게 차단한다.
    ensureDisplayNameAvailable(displayName);

    User newUser = new User(
        email,
        displayName,
        passwordEncoder.encode(password),
        AccountStatus.ACTIVE
    );

    try {
      User saved = userRepository.saveAndFlush(newUser);
      emailVerificationService.clearVerifiedEmail(email);
      return saved.getId();
    } catch (DataIntegrityViolationException ex) {
      // 동시 요청 충돌은 DB 제약 이름을 기준으로 이메일/닉네임 중복으로 변환한다.
      throw UserConstraintViolationSupport.translateRegistrationException(ex);
    }
  }

  @Transactional(readOnly = true)
  public boolean isEmailAvailable(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);
    return userRepository.findByEmail(email)
        .map(user -> user.getAccountStatus() == AccountStatus.INACTIVE)
        .orElse(true);
  }

  @Transactional(readOnly = true)
  public boolean isDisplayNameAvailable(String rawDisplayName) {
    String displayName = normalizeDisplayNameOrThrow(rawDisplayName);
    // 비활성 계정은 닉네임을 점유하지 않는 것으로 본다.
    return !userRepository.existsByDisplayNameAndAccountStatus(displayName, AccountStatus.ACTIVE);
  }

  private void ensureDisplayNameAvailable(String displayName) {
    if (userRepository.existsByDisplayNameAndAccountStatus(displayName, AccountStatus.ACTIVE)) {
      throw new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME);
    }
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

  private String normalizeDisplayNameOrThrow(String rawDisplayName) {
    if (rawDisplayName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawDisplayName.trim();
    if (normalized.isEmpty() || normalized.length() > MAX_DISPLAY_NAME_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }

  private String normalizePasswordOrThrow(String rawPassword) {
    if (rawPassword == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    if (rawPassword.isBlank() || rawPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return rawPassword;
  }
}
