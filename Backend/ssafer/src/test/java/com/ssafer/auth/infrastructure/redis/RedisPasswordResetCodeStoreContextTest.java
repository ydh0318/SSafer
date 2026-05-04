package com.ssafer.auth.infrastructure.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

@SpringJUnitConfig(classes = RedisPasswordResetCodeStoreContextTest.TestConfig.class)
class RedisPasswordResetCodeStoreContextTest {

  @SuppressWarnings("unchecked")
  @Configuration
  static class TestConfig {

    @Bean
    StringRedisTemplate stringRedisTemplate() {
      StringRedisTemplate template = Mockito.mock(StringRedisTemplate.class);
      ValueOperations<String, String> valueOperations = Mockito.mock(ValueOperations.class);
      given(template.opsForValue()).willReturn(valueOperations);
      return template;
    }

    @Bean
    RedisPasswordResetCodeStore redisPasswordResetCodeStore(StringRedisTemplate stringRedisTemplate) {
      return new RedisPasswordResetCodeStore(stringRedisTemplate);
    }
  }

  @org.springframework.beans.factory.annotation.Autowired
  private RedisPasswordResetCodeStore redisPasswordResetCodeStore;

  @org.springframework.beans.factory.annotation.Autowired
  private StringRedisTemplate stringRedisTemplate;

  @Test
  void storeBeanIsWiredAndDelegatesToTemplate() {
    @SuppressWarnings("unchecked")
    ValueOperations<String, String> valueOperations = stringRedisTemplate.opsForValue();
    given(valueOperations.setIfAbsent("password-reset:cooldown:user@ssafer.co.kr", "1", Duration.ofSeconds(60)))
        .willReturn(true);

    boolean saved = redisPasswordResetCodeStore.saveCodeIfCooldownNotActive(
        "user@ssafer.co.kr",
        "123456",
        Duration.ofSeconds(300),
        Duration.ofSeconds(60)
    );

    assertThat(saved).isTrue();
    then(valueOperations).should().set("password-reset:code:user@ssafer.co.kr", "123456", Duration.ofSeconds(300));
  }
}
