package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthApiClient;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthEmailResponse;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthTokenResponse;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthUserResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class GithubOAuthLoginProviderHandler implements OAuthLoginProviderHandler {

  private final GithubOAuthApiClient githubOAuthApiClient;

  @Override
  public OAuthProvider provider() {
    return OAuthProvider.GITHUB;
  }

  @Override
  public OAuthProviderUserInfo fetchUserInfo(String authorizationCode, String redirectUri) {
    GithubOAuthTokenResponse tokenResponse = githubOAuthApiClient.exchangeAuthorizationCode(authorizationCode, redirectUri);
    if (tokenResponse.accessToken() == null || tokenResponse.accessToken().isBlank()) {
      log.error("GitHub OAuth 토큰 교환 응답에 access token 이 없습니다.");
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }

    GithubOAuthUserResponse userInfo = githubOAuthApiClient.fetchUserInfo(tokenResponse.accessToken());
    List<GithubOAuthEmailResponse> emails = githubOAuthApiClient.fetchUserEmails(tokenResponse.accessToken());
    GithubOAuthEmailResponse verifiedEmail = resolveVerifiedEmail(emails);

    if (userInfo.id() == null || verifiedEmail == null || verifiedEmail.email() == null || verifiedEmail.email().isBlank()) {
      log.warn(
          "GitHub OAuth 사용자 정보가 유효하지 않습니다. userIdPresent={}, verifiedEmailPresent={}",
          userInfo.id() != null,
          verifiedEmail != null && verifiedEmail.email() != null && !verifiedEmail.email().isBlank()
      );
      throw new BusinessException(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
    }

    return new OAuthProviderUserInfo(
        OAuthProvider.GITHUB,
        String.valueOf(userInfo.id()),
        verifiedEmail.email(),
        resolveDisplayName(userInfo, verifiedEmail.email())
    );
  }

  // 기존 사용자 매칭 기준이 이메일이므로 GitHub에서도 verified email만 신뢰한다.
  private GithubOAuthEmailResponse resolveVerifiedEmail(List<GithubOAuthEmailResponse> emails) {
    if (emails == null || emails.isEmpty()) {
      return null;
    }

    for (GithubOAuthEmailResponse email : emails) {
      if (isVerifiedPrimary(email)) {
        return email;
      }
    }

    for (GithubOAuthEmailResponse email : emails) {
      if (isVerified(email)) {
        return email;
      }
    }

    return null;
  }

  private String resolveDisplayName(GithubOAuthUserResponse userInfo, String fallbackEmail) {
    if (userInfo.name() != null && !userInfo.name().isBlank()) {
      return userInfo.name();
    }
    if (userInfo.login() != null && !userInfo.login().isBlank()) {
      return userInfo.login();
    }
    return fallbackEmail;
  }

  private boolean isVerifiedPrimary(GithubOAuthEmailResponse email) {
    return email != null && Boolean.TRUE.equals(email.verified()) && Boolean.TRUE.equals(email.primary());
  }

  private boolean isVerified(GithubOAuthEmailResponse email) {
    return email != null && Boolean.TRUE.equals(email.verified());
  }
}
