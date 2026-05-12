package com.ssafer.user.application.service;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPasswordService {

  private static final int MAX_EMAIL_LENGTH = 255;
  private static final int MIN_PASSWORD_LENGTH = 8;
  private static final int MAX_PASSWORD_LENGTH = 72;

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final RefreshTokenStore refreshTokenStore;
  private final AuthTokenProvider authTokenProvider;

  public UserPasswordService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      RefreshTokenStore refreshTokenStore,
      AuthTokenProvider authTokenProvider
  ) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.refreshTokenStore = refreshTokenStore;
    this.authTokenProvider = authTokenProvider;
  }

  @Transactional
  public AuthTokenResult changePassword(AuthenticatedActor actor, String rawCurrentPassword, String rawNewPassword) {
    User user = loadCurrentMemberOrThrow(actor);
    String currentPassword = normalizePasswordOrThrow(rawCurrentPassword);
    String newPassword = normalizePasswordOrThrow(rawNewPassword);
    String passwordHash = user.getPasswordHash();

    if (passwordHash == null || passwordHash.isBlank() || !passwordEncoder.matches(currentPassword, passwordHash)) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (passwordEncoder.matches(newPassword, passwordHash)) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    user.updatePasswordHash(passwordEncoder.encode(newPassword));
    refreshTokenStore.delete(user.getId());
    return authTokenProvider.issueTokens(user.getId());
  }

  @Transactional
  public AuthTokenResult setupPassword(AuthenticatedActor actor, String rawNewPassword) {
    User user = loadCurrentMemberOrThrow(actor);
    String newPassword = normalizePasswordOrThrow(rawNewPassword);

    // 최초 설정 API는 로컬 비밀번호가 없는 계정에서만 허용한다.
    if (user.hasPasswordCredential()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    user.updatePasswordHash(passwordEncoder.encode(newPassword));
    refreshTokenStore.delete(user.getId());
    return authTokenProvider.issueTokens(user.getId());
  }

  @Transactional
  public void resetPassword(String rawEmail, String rawNewPassword) {
    String email = normalizeEmailOrThrow(rawEmail);
    String newPassword = normalizePasswordOrThrow(rawNewPassword);
    User user = loadResettableUserByEmailOrThrow(email);

    // 기존 비밀번호와 같은 값으로 재설정하지 못하도록 막는다.
    if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    user.updatePasswordHash(passwordEncoder.encode(newPassword));
    // 비밀번호가 바뀌면 기존 로그인 상태를 이어서 사용하지 못하게 한다.
    refreshTokenStore.delete(user.getId());
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private User loadResettableUserByEmailOrThrow(String email) {
    return userRepository.findByEmail(email)
        .filter(user -> user.isActive() && user.getPasswordHash() != null && !user.getPasswordHash().isBlank())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
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

    if (rawPassword.isBlank()
        || rawPassword.length() < MIN_PASSWORD_LENGTH
        || rawPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return rawPassword;
  }
}
