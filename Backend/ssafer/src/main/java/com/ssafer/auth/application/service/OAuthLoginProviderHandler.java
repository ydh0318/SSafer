package com.ssafer.auth.application.service;

import com.ssafer.auth.domain.enums.OAuthProvider;

public interface OAuthLoginProviderHandler {

  OAuthProvider provider();

  OAuthProviderUserInfo fetchUserInfo(String authorizationCode, String redirectUri);
}
