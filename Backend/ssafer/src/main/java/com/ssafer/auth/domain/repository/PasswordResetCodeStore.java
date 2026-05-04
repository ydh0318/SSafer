package com.ssafer.auth.domain.repository;

import java.time.Duration;
import java.util.Optional;

public interface PasswordResetCodeStore {

  boolean saveCodeIfCooldownNotActive(String email, String code, Duration codeTtl, Duration cooldownTtl);

  Optional<String> findCode(String email);

  void deleteCode(String email);

  void deleteCodeAndCooldown(String email);

  void saveResetToken(String email, String resetToken, Duration resetTokenTtl);

  Optional<String> consumeResetToken(String resetToken);

  long incrementCodeVerificationFailures(String email, Duration failureTtl);

  void clearCodeVerificationFailures(String email);
}
