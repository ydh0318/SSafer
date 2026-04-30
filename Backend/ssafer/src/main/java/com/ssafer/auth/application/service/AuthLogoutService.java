package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.springframework.stereotype.Service;

@Service
public class AuthLogoutService {

  private final AuthTokenProvider authTokenProvider;

  public AuthLogoutService(AuthTokenProvider authTokenProvider) {
    this.authTokenProvider = authTokenProvider;
  }

  public void logout(String rawRefreshToken) {
    String refreshToken = normalizeRefreshTokenOrThrow(rawRefreshToken);
    authTokenProvider.revokeRefreshToken(refreshToken);
  }

  private String normalizeRefreshTokenOrThrow(String rawRefreshToken) {
    if (rawRefreshToken == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawRefreshToken.trim();
    // 로그아웃도 재발급과 동일하게 refresh token 문자열 하나만 받아 처리한다.
    if (normalized.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }
}
