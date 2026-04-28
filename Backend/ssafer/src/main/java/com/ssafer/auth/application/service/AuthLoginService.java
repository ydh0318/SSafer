package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthLoginService {

  private static final int MAX_EMAIL_LENGTH = 255;
  private static final int MAX_PASSWORD_LENGTH = 72;

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuthTokenProvider authTokenProvider;

  public AuthLoginService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      AuthTokenProvider authTokenProvider
  ) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.authTokenProvider = authTokenProvider;
  }

  @Transactional(readOnly = true)
  public AuthTokenResult login(String rawEmail, String rawPassword) {
    String email = normalizeEmailOrThrow(rawEmail);
    String password = normalizePasswordOrThrow(rawPassword);

    // 사용자 존재 여부와 상태, 비밀번호 불일치를 같은 응답으로 묶어 계정 정보를 숨긴다.
    User user = userRepository.findByEmail(email)
        .filter(foundUser -> foundUser.getAccountStatus() == AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

    // 비밀번호가 없는 계정은 자체 로그인 대상이 아니므로 같은 자격 증명 오류로 처리한다.
    String passwordHash = user.getPasswordHash();
    if (passwordHash == null || passwordHash.isBlank()) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!passwordEncoder.matches(password, passwordHash)) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
    }

    return authTokenProvider.issueTokens(user.getId());
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

  private String normalizePasswordOrThrow(String rawPassword) {
    if (rawPassword == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 로그인에서도 비밀번호 원문을 그대로 비교해야 회원가입 시 저장한 해시와 일관된다.
    if (rawPassword.isBlank() || rawPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return rawPassword;
  }
}
