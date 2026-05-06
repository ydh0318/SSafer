package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthOAuthLoginService {

  private final Map<OAuthProvider, OAuthLoginProviderHandler> handlers;

  public AuthOAuthLoginService(List<OAuthLoginProviderHandler> handlers) {
    this.handlers = new EnumMap<>(OAuthProvider.class);
    for (OAuthLoginProviderHandler handler : handlers) {
      this.handlers.put(handler.provider(), handler);
    }
  }

  @Transactional(readOnly = true)
  public OAuthProviderUserInfo login(OAuthProvider provider, String authorizationCode, String redirectUri) {
    OAuthLoginProviderHandler handler = handlers.get(provider);
    if (handler == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // provider별 인가 코드 교환과 사용자 정보 조회는 handler 구현체에 위임한다.
    return handler.fetchUserInfo(authorizationCode, redirectUri);
  }
}
