package com.ssafer.auth.infrastructure.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class RedisPasswordResetCodeStoreTest {

  private StringRedisTemplate stringRedisTemplate;
  private ValueOperations<String, String> valueOperations;
  private RedisPasswordResetCodeStore passwordResetCodeStore;

  @SuppressWarnings("unchecked")
  @BeforeEach
  void setUp() {
    stringRedisTemplate = Mockito.mock(StringRedisTemplate.class);
    valueOperations = Mockito.mock(ValueOperations.class);
    given(stringRedisTemplate.opsForValue()).willReturn(valueOperations);
    passwordResetCodeStore = new RedisPasswordResetCodeStore(stringRedisTemplate);
  }

  @Test
  void saveCodeIfCooldownNotActiveStoresCooldownAndCode() {
    given(valueOperations.setIfAbsent("password-reset:cooldown:user@ssafer.co.kr", "1", Duration.ofSeconds(60)))
        .willReturn(true);

    boolean saved = passwordResetCodeStore.saveCodeIfCooldownNotActive(
        "user@ssafer.co.kr",
        "123456",
        Duration.ofSeconds(300),
        Duration.ofSeconds(60)
    );

    assertThat(saved).isTrue();
    then(valueOperations).should().set("password-reset:code:user@ssafer.co.kr", "123456", Duration.ofSeconds(300));
  }

  @Test
  void findCodeReturnsStoredCode() {
    given(valueOperations.get("password-reset:code:user@ssafer.co.kr")).willReturn("123456");

    assertThat(passwordResetCodeStore.findCode("user@ssafer.co.kr")).contains("123456");
  }

  @Test
  void deleteCodeRemovesCodeKey() {
    passwordResetCodeStore.deleteCode("user@ssafer.co.kr");

    then(stringRedisTemplate).should().delete("password-reset:code:user@ssafer.co.kr");
  }

  @Test
  void deleteCodeAndCooldownRemovesBothKeys() {
    passwordResetCodeStore.deleteCodeAndCooldown("user@ssafer.co.kr");

    then(stringRedisTemplate).should().delete(List.of(
        "password-reset:code:user@ssafer.co.kr",
        "password-reset:cooldown:user@ssafer.co.kr"
    ));
  }

  @Test
  void markVerifiedStoresVerifiedKeyWithTtl() {
    passwordResetCodeStore.markVerified("user@ssafer.co.kr", Duration.ofMinutes(30));

    then(valueOperations).should().set("password-reset:verified:user@ssafer.co.kr", "true", Duration.ofMinutes(30));
  }

  @Test
  void isVerifiedReturnsTrueWhenVerifiedKeyExists() {
    given(stringRedisTemplate.hasKey("password-reset:verified:user@ssafer.co.kr")).willReturn(true);

    assertThat(passwordResetCodeStore.isVerified("user@ssafer.co.kr")).isTrue();
  }

  @Test
  void clearVerifiedRemovesVerifiedKey() {
    passwordResetCodeStore.clearVerified("user@ssafer.co.kr");

    then(stringRedisTemplate).should().delete("password-reset:verified:user@ssafer.co.kr");
  }
}
