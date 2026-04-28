package com.ssafer.auth.infrastructure.redis;

import com.ssafer.auth.domain.repository.EmailVerificationStore;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RedisEmailVerificationStore implements EmailVerificationStore {

  private static final String CODE_KEY_PREFIX = "email-verification:code:";
  private static final String COOLDOWN_KEY_PREFIX = "email-verification:cooldown:";
  private static final String VERIFIED_KEY_PREFIX = "email-verification:verified:";

  private final StringRedisTemplate stringRedisTemplate;

  public RedisEmailVerificationStore(StringRedisTemplate stringRedisTemplate) {
    this.stringRedisTemplate = stringRedisTemplate;
  }

  @Override
  public boolean saveCodeIfCooldownNotActive(String email, String code, Duration codeTtl, Duration cooldownTtl) {
    // cooldown 키를 먼저 선점해서 동시에 들어온 요청도 한 건만 통과시킨다.
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
    // 메일 전송이 실패하면 코드와 cooldown을 함께 지워서 즉시 재요청할 수 있게 한다.
    stringRedisTemplate.delete(List.of(buildCodeKey(email), buildCooldownKey(email)));
  }

  @Override
  public boolean isCooldownActive(String email) {
    return Boolean.TRUE.equals(stringRedisTemplate.hasKey(buildCooldownKey(email)));
  }

  @Override
  public void markVerified(String email, Duration verifiedTtl) {
    stringRedisTemplate.opsForValue().set(buildVerifiedKey(email), "true", verifiedTtl);
  }

  @Override
  public boolean isVerified(String email) {
    return Boolean.TRUE.equals(stringRedisTemplate.hasKey(buildVerifiedKey(email)));
  }

  @Override
  public void clearVerified(String email) {
    stringRedisTemplate.delete(buildVerifiedKey(email));
  }

  private String buildCodeKey(String email) {
    return CODE_KEY_PREFIX + email;
  }

  private String buildCooldownKey(String email) {
    return COOLDOWN_KEY_PREFIX + email;
  }

  private String buildVerifiedKey(String email) {
    return VERIFIED_KEY_PREFIX + email;
  }
}
