package com.ssafer.auth.infrastructure.oauth.google;

public interface GoogleOAuthApiClient {

  GoogleOAuthTokenResponse exchangeAuthorizationCode(String authorizationCode, String redirectUri);

  GoogleOAuthUserInfoResponse fetchUserInfo(String accessToken);
}
