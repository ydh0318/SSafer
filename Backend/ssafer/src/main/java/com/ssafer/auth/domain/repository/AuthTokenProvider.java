package com.ssafer.auth.domain.repository;

import com.ssafer.auth.application.service.AuthTokenResult;

public interface AuthTokenProvider {

  AuthTokenResult issueTokens(Long userId);
}
