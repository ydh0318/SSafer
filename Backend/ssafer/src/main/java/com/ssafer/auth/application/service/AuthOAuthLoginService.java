package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthOAuthLoginService {

  private static final int MAX_DISPLAY_NAME_LENGTH = 100;
  private static final int MAX_DISPLAY_NAME_ATTEMPTS = 20;

  private final Map<OAuthProvider, OAuthLoginProviderHandler> handlers;
  private final UserRepository userRepository;
  private final AuthTokenProvider authTokenProvider;

  public AuthOAuthLoginService(
      List<OAuthLoginProviderHandler> handlers,
      UserRepository userRepository,
      AuthTokenProvider authTokenProvider
  ) {
    this.handlers = new EnumMap<>(OAuthProvider.class);
    for (OAuthLoginProviderHandler handler : handlers) {
      this.handlers.put(handler.provider(), handler);
    }
    this.userRepository = userRepository;
    this.authTokenProvider = authTokenProvider;
  }

  @Transactional
  public OAuthLoginResult login(OAuthProvider provider, String authorizationCode, String redirectUri) {
    OAuthLoginProviderHandler handler = handlers.get(provider);
    if (handler == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // provider별 코드 교환과 사용자 정보 조회는 handler 구현체에 위임한다.
    OAuthProviderUserInfo userInfo = handler.fetchUserInfo(authorizationCode, redirectUri);
    String normalizedEmail = normalizeEmail(userInfo.email());

    ResolvedOAuthUser resolvedUser = resolveOrCreateUser(normalizedEmail, userInfo.displayName());
    if (resolvedUser.user().getAccountStatus() != AccountStatus.ACTIVE) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }

    AuthTokenResult tokenResult = authTokenProvider.issueTokens(resolvedUser.user().getId());
    return new OAuthLoginResult(
        userInfo.provider(),
        userInfo.providerUserId(),
        normalizedEmail,
        resolvedUser.user().getDisplayName(),
        resolvedUser.newUserCreated(),
        resolvedUser.user().getId(),
        resolvedUser.user().getAccountStatus(),
        tokenResult.accessToken(),
        tokenResult.accessTokenExpiresAt(),
        tokenResult.refreshToken(),
        tokenResult.refreshTokenExpiresAt()
    );
  }

  private ResolvedOAuthUser resolveOrCreateUser(String email, String providerDisplayName) {
    User existingUser = userRepository.findByEmail(email).orElse(null);
    if (existingUser != null) {
      return new ResolvedOAuthUser(existingUser, false);
    }

    String baseDisplayName = normalizeDisplayNameCandidate(providerDisplayName, email);

    for (int attempt = 0; attempt <= MAX_DISPLAY_NAME_ATTEMPTS; attempt++) {
      String candidate = buildDisplayNameCandidate(baseDisplayName, attempt);
      if (userRepository.existsByDisplayNameAndAccountStatus(candidate, AccountStatus.ACTIVE)) {
        continue;
      }

      try {
        User createdUser = userRepository.saveAndFlush(new User(
            email,
            candidate,
            null,
            AccountStatus.ACTIVE
        ));
        return new ResolvedOAuthUser(createdUser, true);
      } catch (DataIntegrityViolationException ex) {
        // 이메일 동시 생성 충돌이면 이미 만들어진 사용자를 다시 읽어 그대로 로그인 처리한다.
        User racedUser = userRepository.findByEmail(email).orElse(null);
        if (racedUser != null) {
          return new ResolvedOAuthUser(racedUser, false);
        }
      }
    }

    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  private String normalizeEmail(String rawEmail) {
    if (rawEmail == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    String normalized = rawEmail.trim().toLowerCase(Locale.ROOT);
    if (normalized.isBlank() || !normalized.contains("@")) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
    return normalized;
  }

  private String normalizeDisplayNameCandidate(String rawDisplayName, String email) {
    String candidate = rawDisplayName == null ? "" : rawDisplayName.trim();
    if (candidate.isBlank()) {
      int atIndex = email.indexOf('@');
      candidate = atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    if (candidate.length() > MAX_DISPLAY_NAME_LENGTH) {
      candidate = candidate.substring(0, MAX_DISPLAY_NAME_LENGTH).trim();
    }

    return candidate.isBlank() ? "user" : candidate;
  }

  private String buildDisplayNameCandidate(String baseDisplayName, int attempt) {
    if (attempt == 0) {
      return baseDisplayName;
    }

    String suffix = "_" + attempt;
    int maxBaseLength = Math.max(1, MAX_DISPLAY_NAME_LENGTH - suffix.length());
    String trimmedBase = baseDisplayName.length() > maxBaseLength
        ? baseDisplayName.substring(0, maxBaseLength).trim()
        : baseDisplayName;
    if (trimmedBase.isBlank()) {
      trimmedBase = "user";
    }
    return trimmedBase + suffix;
  }

  private record ResolvedOAuthUser(User user, boolean newUserCreated) {
  }
}
