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
  private static final String VERIFIED_KEY_PREFIX = "password-reset:verified:";

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
  public void markVerified(String email, Duration verifiedTtl) {
    // 인증코드 검증이 끝난 이메일만 재설정 완료 API를 호출할 수 있도록 verified 상태를 저장한다.
    stringRedisTemplate.opsForValue().set(buildVerifiedKey(email), "true", verifiedTtl);
  }

  @Override
  public boolean isVerified(String email) {
    return Boolean.TRUE.equals(stringRedisTemplate.hasKey(buildVerifiedKey(email)));
  }

  @Override
  public void clearVerified(String email) {
    // 비밀번호 재설정이 끝나면 verified 상태를 즉시 제거한다.
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
