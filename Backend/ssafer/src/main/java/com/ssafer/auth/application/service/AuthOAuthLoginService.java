package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.auth.domain.repository.OAuthRejoinTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.RejoinRequiredException;
import com.ssafer.user.application.service.UserSocialAccountService;
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
  private final UserSocialAccountService userSocialAccountService;
  private final OAuthRejoinTokenProvider oAuthRejoinTokenProvider;
  private final AuthTokenProvider authTokenProvider;

  public AuthOAuthLoginService(
      List<OAuthLoginProviderHandler> handlers,
      UserRepository userRepository,
      UserSocialAccountService userSocialAccountService,
      OAuthRejoinTokenProvider oAuthRejoinTokenProvider,
      AuthTokenProvider authTokenProvider
  ) {
    this.handlers = new EnumMap<>(OAuthProvider.class);
    for (OAuthLoginProviderHandler handler : handlers) {
      this.handlers.put(handler.provider(), handler);
    }
    this.userRepository = userRepository;
    this.userSocialAccountService = userSocialAccountService;
    this.oAuthRejoinTokenProvider = oAuthRejoinTokenProvider;
    this.authTokenProvider = authTokenProvider;
  }

  @Transactional
  public OAuthLoginResult login(
      OAuthProvider provider,
      String authorizationCode,
      String redirectUri,
      boolean confirmRejoin,
      String rejoinToken
  ) {
    if (confirmRejoin) {
      // 재가입 확인 단계에서는 같은 OAuth 인가 코드를 두 번 소비하지 않도록 rejoinToken만 사용한다.
      return rejoin(provider, rejoinToken);
    }

    OAuthLoginProviderHandler handler = handlers.get(provider);
    if (handler == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    OAuthProviderUserInfo userInfo = handler.fetchUserInfo(authorizationCode, redirectUri);
    String normalizedEmail = normalizeEmail(userInfo.email());

    // 소셜 링크를 가장 먼저 신뢰하고, 그다음 이메일로 기존 계정을 찾고,
    // 둘 다 없을 때만 신규 회원을 생성한다.
    ResolvedOAuthUser resolvedUser = resolveOrCreateUser(userInfo, normalizedEmail, userInfo.displayName());
    User user = resolvedUser.user();
    if (user.getAccountStatus() != AccountStatus.ACTIVE) {
      throw new RejoinRequiredException(issueRejoinToken(user, userInfo, normalizedEmail));
    }

    userSocialAccountService.syncSocialLogin(user, userInfo);
    AuthTokenResult tokenResult = authTokenProvider.issueTokens(user.getId());
    return buildResult(userInfo, normalizedEmail, resolvedUser.newUserCreated(), user, tokenResult);
  }

  private OAuthLoginResult rejoin(OAuthProvider provider, String rejoinToken) {
    OAuthRejoinTokenPayload payload = oAuthRejoinTokenProvider.parseToken(rejoinToken);
    if (payload.provider() != provider) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    User user = userRepository.findById(payload.userId())
        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    if (user.getAccountStatus() != AccountStatus.INACTIVE) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }

    String normalizedEmail = normalizeEmail(payload.email());
    User reactivatedUser = reactivateWithdrawnUser(user, normalizedEmail, payload.displayName());
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        payload.provider(),
        payload.providerUserId(),
        payload.email(),
        payload.displayName()
    );
    userSocialAccountService.syncSocialLogin(reactivatedUser, userInfo);
    AuthTokenResult tokenResult = authTokenProvider.issueTokens(reactivatedUser.getId());
    return buildResult(userInfo, normalizedEmail, false, reactivatedUser, tokenResult);
  }

  private String issueRejoinToken(User user, OAuthProviderUserInfo userInfo, String normalizedEmail) {
    return oAuthRejoinTokenProvider.issueToken(new OAuthRejoinTokenPayload(
        user.getId(),
        userInfo.provider(),
        userInfo.providerUserId(),
        normalizedEmail,
        userInfo.displayName()
    ));
  }

  private OAuthLoginResult buildResult(
      OAuthProviderUserInfo userInfo,
      String normalizedEmail,
      boolean newUserCreated,
      User user,
      AuthTokenResult tokenResult
  ) {
    return new OAuthLoginResult(
        userInfo.provider(),
        userInfo.providerUserId(),
        normalizedEmail,
        user.getDisplayName(),
        newUserCreated,
        user.getId(),
        user.getAccountStatus(),
        tokenResult.accessToken(),
        tokenResult.accessTokenExpiresAt(),
        tokenResult.refreshToken(),
        tokenResult.refreshTokenExpiresAt()
    );
  }

  private ResolvedOAuthUser resolveOrCreateUser(
      OAuthProviderUserInfo userInfo,
      String email,
      String providerDisplayName
  ) {
    User linkedUser = userSocialAccountService.findLinkedUser(userInfo.provider(), userInfo.providerUserId())
        .orElse(null);
    if (linkedUser != null) {
      return new ResolvedOAuthUser(linkedUser, false);
    }

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
        User racedUser = userRepository.findByEmail(email).orElse(null);
        if (racedUser != null) {
          return new ResolvedOAuthUser(racedUser, false);
        }
      }
    }

    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  private User reactivateWithdrawnUser(User user, String email, String providerDisplayName) {
    String baseDisplayName = normalizeDisplayNameCandidate(user.getDisplayName(), email);
    if (baseDisplayName.isBlank()) {
      baseDisplayName = normalizeDisplayNameCandidate(providerDisplayName, email);
    }

    // 재가입 시 기존 계정 자체는 유지하면서, 휴면 기간 중 생긴 닉네임 충돌만 해소한다.
    String resolvedDisplayName = resolveRejoinDisplayName(user.getId(), baseDisplayName);
    user.reactivateForOAuth(resolvedDisplayName);
    userRepository.flush();
    return user;
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

  private String resolveRejoinDisplayName(Long userId, String baseDisplayName) {
    for (int attempt = 0; attempt <= MAX_DISPLAY_NAME_ATTEMPTS; attempt++) {
      String candidate = buildDisplayNameCandidate(baseDisplayName, attempt);
      if (!userRepository.existsByDisplayNameAndAccountStatusAndIdNot(candidate, AccountStatus.ACTIVE, userId)) {
        return candidate;
      }
    }
    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  private record ResolvedOAuthUser(User user, boolean newUserCreated) {
  }
}
