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
  void saveResetTokenStoresForwardAndReverseKeys() {
    given(valueOperations.get("password-reset:email-token:user@ssafer.co.kr")).willReturn(null);

    passwordResetCodeStore.saveResetToken("user@ssafer.co.kr", "reset-token-123", Duration.ofMinutes(30));

    then(valueOperations).should().set("password-reset:token:reset-token-123", "user@ssafer.co.kr", Duration.ofMinutes(30));
    then(valueOperations).should().set("password-reset:email-token:user@ssafer.co.kr", "reset-token-123", Duration.ofMinutes(30));
  }

  @Test
  void saveResetTokenDeletesPreviousTokenWhenItExists() {
    given(valueOperations.get("password-reset:email-token:user@ssafer.co.kr")).willReturn("old-token");

    passwordResetCodeStore.saveResetToken("user@ssafer.co.kr", "new-token", Duration.ofMinutes(30));

    then(stringRedisTemplate).should().delete("password-reset:token:old-token");
  }

  @Test
  void consumeResetTokenReturnsStoredEmailAndDeletesReverseKey() {
    given(valueOperations.getAndDelete("password-reset:token:reset-token-123")).willReturn("user@ssafer.co.kr");

    assertThat(passwordResetCodeStore.consumeResetToken("reset-token-123")).contains("user@ssafer.co.kr");
    then(stringRedisTemplate).should().delete("password-reset:email-token:user@ssafer.co.kr");
  }

  @Test
  void consumeResetTokenReturnsEmptyWhenTokenDoesNotExist() {
    given(valueOperations.getAndDelete("password-reset:token:reset-token-123")).willReturn(null);

    assertThat(passwordResetCodeStore.consumeResetToken("reset-token-123")).isEmpty();
  }
}
