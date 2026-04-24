package com.ssafer.guest.infrastructure.token;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.guest.application.service.GuestEnterResult;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class JwtGuestTokenProviderTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";

  @Test
  void issueGuestTokenContainsExpectedClaims() {
    JwtGuestTokenProvider provider = new JwtGuestTokenProvider(SECRET, "ssafer", 7200);

    GuestEnterResult result = provider.issueGuestToken("web-guest-001");
    Claims claims = Jwts.parser()
        .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
        .build()
        .parseSignedClaims(result.guestAccessToken())
        .getPayload();

    assertThat(claims.getSubject()).startsWith("guest:");
    assertThat(claims.getIssuer()).isEqualTo("ssafer");
    assertThat(claims.get("role", String.class)).isEqualTo("GUEST");
    assertThat(claims.getExpiration().toInstant()).isEqualTo(result.expiresAt());
  }
}
