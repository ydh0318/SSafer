package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.springframework.stereotype.Service;

@Service
public class AuthTokenRefreshService {

  private final AuthTokenProvider authTokenProvider;

  public AuthTokenRefreshService(AuthTokenProvider authTokenProvider) {
    this.authTokenProvider = authTokenProvider;
  }

  public AuthTokenResult refresh(String rawRefreshToken) {
    String refreshToken = normalizeRefreshTokenOrThrow(rawRefreshToken);
    return authTokenProvider.reissueTokens(refreshToken);
  }

  private String normalizeRefreshTokenOrThrow(String rawRefreshToken) {
    if (rawRefreshToken == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawRefreshToken.trim();
    // 재발급 API는 토큰 문자열 자체가 본문이므로 공백/빈 값은 잘못된 요청으로 처리한다.
    if (normalized.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }
}
