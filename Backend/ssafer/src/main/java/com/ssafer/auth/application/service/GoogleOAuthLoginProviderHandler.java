package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthApiClient;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthTokenResponse;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthUserInfoResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GoogleOAuthLoginProviderHandler implements OAuthLoginProviderHandler {

  private final GoogleOAuthApiClient googleOAuthApiClient;

  @Override
  public OAuthProvider provider() {
    return OAuthProvider.GOOGLE;
  }

  @Override
  public OAuthProviderUserInfo fetchUserInfo(String authorizationCode, String redirectUri) {
    GoogleOAuthTokenResponse tokenResponse = googleOAuthApiClient.exchangeAuthorizationCode(authorizationCode, redirectUri);
    if (tokenResponse.accessToken() == null || tokenResponse.accessToken().isBlank()) {
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }

    GoogleOAuthUserInfoResponse userInfo = googleOAuthApiClient.fetchUserInfo(tokenResponse.accessToken());
    // 기존 사용자 매칭 기준이 이메일이므로 Google의 verified email만 신뢰한다.
    if (userInfo.sub() == null
        || userInfo.sub().isBlank()
        || userInfo.email() == null
        || userInfo.email().isBlank()
        || !Boolean.TRUE.equals(userInfo.emailVerified())) {
      throw new BusinessException(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
    }

    return new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        userInfo.sub(),
        userInfo.email(),
        userInfo.name() != null && !userInfo.name().isBlank() ? userInfo.name() : userInfo.email()
    );
  }
}
