package com.ssafer.auth.infrastructure.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class RedisRefreshTokenStoreTest {

  private StringRedisTemplate stringRedisTemplate;
  private ValueOperations<String, String> valueOperations;
  private RedisRefreshTokenStore refreshTokenStore;

  @SuppressWarnings("unchecked")
  @BeforeEach
  void setUp() {
    stringRedisTemplate = Mockito.mock(StringRedisTemplate.class);
    valueOperations = Mockito.mock(ValueOperations.class);
    given(stringRedisTemplate.opsForValue()).willReturn(valueOperations);
    refreshTokenStore = new RedisRefreshTokenStore(stringRedisTemplate);
  }

  @Test
  void saveStoresRefreshTokenWithUserScopedKeyAndTtl() {
    refreshTokenStore.save(7L, "refresh-token", Duration.ofDays(14));

    then(valueOperations).should().set("auth:refresh-token:7", "refresh-token", Duration.ofDays(14));
  }

  @Test
  void findByUserIdReturnsStoredRefreshToken() {
    given(valueOperations.get("auth:refresh-token:7")).willReturn("refresh-token");

    assertThat(refreshTokenStore.findByUserId(7L)).contains("refresh-token");
  }

  @Test
  void deleteRemovesUserScopedRefreshTokenKey() {
    refreshTokenStore.delete(7L);

    then(stringRedisTemplate).should().delete("auth:refresh-token:7");
  }

  @Test
  void saveThrowsWhenUserIdIsInvalid() {
    assertThatThrownBy(() -> refreshTokenStore.save(0L, "refresh-token", Duration.ofDays(14)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("userId must be a positive number");
  }

  @Test
  void saveThrowsWhenRefreshTokenIsBlank() {
    assertThatThrownBy(() -> refreshTokenStore.save(1L, " ", Duration.ofDays(14)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("refreshToken must not be blank");
  }

  @Test
  void saveThrowsWhenTtlIsNotPositive() {
    assertThatThrownBy(() -> refreshTokenStore.save(1L, "refresh-token", Duration.ZERO))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("ttl must be a positive duration");
  }
}
