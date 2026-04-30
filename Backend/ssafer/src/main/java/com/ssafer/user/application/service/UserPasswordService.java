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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPasswordService {

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

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
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
