package com.ssafer.user.application.service;

import com.ssafer.auth.application.service.EmailVerificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Locale;
import java.util.Optional;
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
    // 가입/재가입 모두 동일한 정규화 규칙을 사용해야 이메일 중복 판단이 일관된다.
    String email = normalizeEmailOrThrow(rawEmail);
    String displayName = normalizeDisplayNameOrThrow(rawDisplayName);
    String password = normalizePasswordOrThrow(rawPassword);

    // 이메일 인증이 끝난 주소만 회원가입이나 재가입을 허용한다.
    if (!emailVerificationService.isVerifiedEmail(email)) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
    }

    Optional<User> existingUser = userRepository.findByEmail(email);
    if (existingUser.isPresent()) {
      User user = existingUser.get();
      if (user.getAccountStatus() == AccountStatus.INACTIVE) {
        // 탈퇴로 비활성화된 동일 이메일 계정은 새 row를 만들지 않고 기존 계정을 되살린다.
        user.reactivate(displayName, passwordEncoder.encode(password));
        emailVerificationService.clearVerifiedEmail(email);
        return user.getId();
      }
      // 활성/정지 계정이 이미 있으면 같은 이메일로는 새 가입을 막는다.
      throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
    }

    User user = new User(
        email,
        displayName,
        passwordEncoder.encode(password),
        AccountStatus.ACTIVE
    );

    try {
      User saved = userRepository.save(user);
      // 인증 완료 상태는 1회성으로 사용하고 가입이 끝나면 정리한다.
      emailVerificationService.clearVerifiedEmail(email);
      return saved.getId();
    } catch (DataIntegrityViolationException ex) {
      // 동시 요청으로 save 시점에 충돌한 경우만 중복 이메일로 변환한다.
      if (userRepository.findByEmail(email)
          .filter(foundUser -> foundUser.getAccountStatus() != AccountStatus.INACTIVE)
          .isPresent()) {
        throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
      }
      throw ex;
    }
  }

  @Transactional(readOnly = true)
  public boolean isEmailAvailable(String rawEmail) {
    String email = normalizeEmailOrThrow(rawEmail);
    // 비활성 계정은 재가입 시 재활성화 대상이므로 사용 가능한 이메일로 본다.
    return userRepository.findByEmail(email)
        .map(user -> user.getAccountStatus() == AccountStatus.INACTIVE)
        .orElse(true);
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
