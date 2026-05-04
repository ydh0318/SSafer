package com.ssafer.auth.domain.repository;

import java.time.Duration;
import java.util.Optional;

public interface PasswordResetCodeStore {

  boolean saveCodeIfCooldownNotActive(String email, String code, Duration codeTtl, Duration cooldownTtl);

  Optional<String> findCode(String email);

  void deleteCode(String email);

  void deleteCodeAndCooldown(String email);

  void markVerified(String email, Duration verifiedTtl);

  boolean isVerified(String email);

  void clearVerified(String email);
}
