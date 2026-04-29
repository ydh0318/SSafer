package com.ssafer.auth.infrastructure.redis;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RedisRefreshTokenStore implements RefreshTokenStore {

  private static final String REFRESH_TOKEN_KEY_PREFIX = "auth:refresh-token:";

  private final StringRedisTemplate stringRedisTemplate;

  public RedisRefreshTokenStore(StringRedisTemplate stringRedisTemplate) {
    this.stringRedisTemplate = stringRedisTemplate;
  }

  @Override
  public void save(Long userId, String refreshToken, Duration ttl) {
    validateUserId(userId);
    validateRefreshToken(refreshToken);
    validateTtl(ttl);

    // 사용자당 하나의 활성 refresh token만 유지하도록 userId를 Redis key로 사용한다.
    stringRedisTemplate.opsForValue().set(buildKey(userId), refreshToken, ttl);
  }

  @Override
  public Optional<String> findByUserId(Long userId) {
    validateUserId(userId);
    return Optional.ofNullable(stringRedisTemplate.opsForValue().get(buildKey(userId)));
  }

  @Override
  public void delete(Long userId) {
    validateUserId(userId);
    stringRedisTemplate.delete(buildKey(userId));
  }

  private String buildKey(Long userId) {
    return REFRESH_TOKEN_KEY_PREFIX + userId;
  }

  private void validateUserId(Long userId) {
    if (userId == null || userId <= 0) {
      throw new IllegalArgumentException("userId must be a positive number");
    }
  }

  private void validateRefreshToken(String refreshToken) {
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new IllegalArgumentException("refreshToken must not be blank");
    }
  }

  private void validateTtl(Duration ttl) {
    if (ttl == null || ttl.isZero() || ttl.isNegative()) {
      throw new IllegalArgumentException("ttl must be a positive duration");
    }
  }
}
