package com.ssafer.user.application.service;

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

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public UserRegistrationService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder
  ) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public Long register(String rawEmail, String rawDisplayName, String rawPassword) {
    // 저장 전에 입력값을 먼저 정규화해서 공백, 대소문자 차이로 인한 중복을 줄인다.
    String email = normalizeEmailOrThrow(rawEmail);
    String displayName = normalizeDisplayNameOrThrow(rawDisplayName);
    String password = normalizePasswordOrThrow(rawPassword);

    // 사전 중복 확인으로 빠르게 실패시키고, 아래 save 구간에서 한 번 더 DB 제약을 방어한다.
    if (userRepository.existsByEmail(email)) {
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
      return saved.getId();
    } catch (DataIntegrityViolationException ex) {
      // 동시 가입 경쟁 상황으로 save 시점에만 중복이 드러날 수 있어서 한 번 더 확인한다.
      if (userRepository.existsByEmail(email)) {
        throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
      }
      throw ex;
    }
  }

  @Transactional(readOnly = true)
  public boolean isEmailAvailable(String rawEmail) {
    // 중복 확인 API도 회원가입과 같은 이메일 정규화 규칙을 사용해야 결과가 일관된다.
    String email = normalizeEmailOrThrow(rawEmail);
    return !userRepository.existsByEmail(email);
  }

  private String normalizeEmailOrThrow(String rawEmail) {
    if (rawEmail == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawEmail.trim().toLowerCase(Locale.ROOT);
    // 현재 단계에서는 간단한 형식 검증만 적용하고, 상세 정책은 다음 태스크에서 확장한다.
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
    // display_name 컬럼 길이에 맞춰 기본 길이 검증만 수행한다.
    if (normalized.isEmpty() || normalized.length() > MAX_DISPLAY_NAME_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }

  private String normalizePasswordOrThrow(String rawPassword) {
    if (rawPassword == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 비밀번호는 사용자가 입력한 원문 자체를 인증값으로 사용하므로 trim 하지 않는다.
    // 다만 공백만 있는 값은 유효한 비밀번호로 보지 않는다.
    if (rawPassword.isBlank() || rawPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return rawPassword;
  }
}
