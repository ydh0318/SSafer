package com.ssafer.auth.domain.repository;

import com.ssafer.auth.application.service.OAuthRejoinTokenPayload;

public interface OAuthRejoinTokenProvider {

  String issueToken(OAuthRejoinTokenPayload payload);

  OAuthRejoinTokenPayload parseToken(String token);
}
