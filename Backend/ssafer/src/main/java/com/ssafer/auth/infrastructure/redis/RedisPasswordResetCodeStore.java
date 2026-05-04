package com.ssafer.auth.infrastructure.redis;

import com.ssafer.auth.domain.repository.PasswordResetCodeStore;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RedisPasswordResetCodeStore implements PasswordResetCodeStore {

  private static final String CODE_KEY_PREFIX = "password-reset:code:";
  private static final String COOLDOWN_KEY_PREFIX = "password-reset:cooldown:";
  private static final String TOKEN_KEY_PREFIX = "password-reset:token:";
  private static final String EMAIL_TOKEN_KEY_PREFIX = "password-reset:email-token:";

  private final StringRedisTemplate stringRedisTemplate;

  public RedisPasswordResetCodeStore(StringRedisTemplate stringRedisTemplate) {
    this.stringRedisTemplate = stringRedisTemplate;
  }

  @Override
  public boolean saveCodeIfCooldownNotActive(String email, String code, Duration codeTtl, Duration cooldownTtl) {
    // 중복 요청 경쟁 상황에서도 최초 요청만 통과시키기 위해 cooldown 키를 먼저 선점한다.
    Boolean reserved = stringRedisTemplate.opsForValue()
        .setIfAbsent(buildCooldownKey(email), "1", cooldownTtl);

    if (!Boolean.TRUE.equals(reserved)) {
      return false;
    }

    stringRedisTemplate.opsForValue().set(buildCodeKey(email), code, codeTtl);
    return true;
  }

  @Override
  public Optional<String> findCode(String email) {
    return Optional.ofNullable(stringRedisTemplate.opsForValue().get(buildCodeKey(email)));
  }

  @Override
  public void deleteCode(String email) {
    stringRedisTemplate.delete(buildCodeKey(email));
  }

  @Override
  public void deleteCodeAndCooldown(String email) {
    // 발송 실패와 같은 롤백 상황에서는 코드와 cooldown을 함께 비운다.
    stringRedisTemplate.delete(List.of(buildCodeKey(email), buildCooldownKey(email)));
  }

  @Override
  public void saveResetToken(String email, String resetToken, Duration resetTokenTtl) {
    // 같은 이메일의 이전 재설정 토큰이 남아 있으면 새 토큰 발급 전에 함께 정리한다.
    String previousToken = stringRedisTemplate.opsForValue().get(buildEmailTokenKey(email));
    if (previousToken != null && !previousToken.isBlank()) {
      stringRedisTemplate.delete(buildTokenKey(previousToken));
    }

    stringRedisTemplate.opsForValue().set(buildTokenKey(resetToken), email, resetTokenTtl);
    stringRedisTemplate.opsForValue().set(buildEmailTokenKey(email), resetToken, resetTokenTtl);
  }

  @Override
  public Optional<String> consumeResetToken(String resetToken) {
    // 재설정 토큰은 한 번만 사용할 수 있도록 token 키를 원자적으로 꺼내면서 삭제한다.
    String email = stringRedisTemplate.opsForValue().getAndDelete(buildTokenKey(resetToken));
    if (email == null || email.isBlank()) {
      return Optional.empty();
    }

    // 역방향 이메일 인덱스는 후속 정리 대상이라 원자성보다 일관성 유지에 집중한다.
    stringRedisTemplate.delete(buildEmailTokenKey(email));
    return Optional.of(email);
  }

  private String buildCodeKey(String email) {
    return CODE_KEY_PREFIX + email;
  }

  private String buildCooldownKey(String email) {
    return COOLDOWN_KEY_PREFIX + email;
  }

  private String buildTokenKey(String resetToken) {
    return TOKEN_KEY_PREFIX + resetToken;
  }

  private String buildEmailTokenKey(String email) {
    return EMAIL_TOKEN_KEY_PREFIX + email;
  }
}
