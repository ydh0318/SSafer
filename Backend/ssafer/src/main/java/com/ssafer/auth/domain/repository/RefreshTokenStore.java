package com.ssafer.auth.domain.repository;

import java.time.Duration;
import java.util.Optional;

public interface RefreshTokenStore {

  void save(Long userId, String refreshToken, Duration ttl);

  Optional<String> findByUserId(Long userId);

  void delete(Long userId);
}
