package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthOAuthLoginService {

  private final Map<OAuthProvider, OAuthLoginProviderHandler> handlers;
  private final UserRepository userRepository;

  public AuthOAuthLoginService(List<OAuthLoginProviderHandler> handlers, UserRepository userRepository) {
    this.handlers = new EnumMap<>(OAuthProvider.class);
    for (OAuthLoginProviderHandler handler : handlers) {
      this.handlers.put(handler.provider(), handler);
    }
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public OAuthLoginResult login(OAuthProvider provider, String authorizationCode, String redirectUri) {
    OAuthLoginProviderHandler handler = handlers.get(provider);
    if (handler == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // provider별 인가 코드 교환과 사용자 정보 조회는 handler 구현체에 위임한다.
    OAuthProviderUserInfo userInfo = handler.fetchUserInfo(authorizationCode, redirectUri);
    String normalizedEmail = normalizeEmail(userInfo.email());

    // 기존 사용자 매칭은 이메일 기준으로만 조회하고, 상태 판단은 다음 단계 JWT 발급 시점에 이어간다.
    User matchedUser = userRepository.findByEmail(normalizedEmail).orElse(null);

    return new OAuthLoginResult(
        userInfo.provider(),
        userInfo.providerUserId(),
        normalizedEmail,
        userInfo.displayName(),
        matchedUser != null,
        matchedUser != null ? matchedUser.getId() : null,
        matchedUser != null ? matchedUser.getAccountStatus() : null
    );
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
}
