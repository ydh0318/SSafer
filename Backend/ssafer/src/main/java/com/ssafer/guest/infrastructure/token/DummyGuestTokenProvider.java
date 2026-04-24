package com.ssafer.guest.infrastructure.token;

import com.ssafer.guest.application.service.GuestEnterResult;
import com.ssafer.guest.domain.repository.GuestTokenProvider;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class DummyGuestTokenProvider implements GuestTokenProvider {
  // 임시 구현체이며, JWT 도입 시 실제 구현체로 교체한다.

  private static final Duration EXPIRES_IN = Duration.ofHours(24);

  @Override
  public GuestEnterResult issueGuestToken(String deviceId) {
    String token = "guest-temp-token-" + UUID.randomUUID();
    Instant expiresAt = Instant.now().plus(EXPIRES_IN);
    return new GuestEnterResult(token, expiresAt);
  }
}
