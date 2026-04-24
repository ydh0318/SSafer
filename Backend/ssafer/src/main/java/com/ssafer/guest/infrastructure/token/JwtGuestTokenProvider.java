package com.ssafer.guest.infrastructure.token;

import com.ssafer.guest.application.service.GuestEnterResult;
import com.ssafer.guest.domain.repository.GuestTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtGuestTokenProvider implements GuestTokenProvider {

  private static final String GUEST_SUBJECT_PREFIX = "guest:";
  private static final String ROLE_CLAIM_KEY = "role";
  private static final String GUEST_ROLE = "GUEST";

  private final SecretKey secretKey;
  private final String issuer;
  private final Duration accessTokenTtl;

  public JwtGuestTokenProvider(
      @Value("${JWT_SECRET}") String jwtSecret,
      @Value("${JWT_ISSUER:ssafer}") String issuer,
      @Value("${JWT_ACCESS_TOKEN_EXPIRES_SECONDS:7200}") long expiresSeconds
  ) {
    this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    this.issuer = issuer;
    this.accessTokenTtl = Duration.ofSeconds(expiresSeconds);
  }

  @Override
  public GuestEnterResult issueGuestToken(String deviceId) {
    Instant issuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    Instant expiresAt = issuedAt.plus(accessTokenTtl);
    String subject = GUEST_SUBJECT_PREFIX + UUID.randomUUID();

    String token = Jwts.builder()
        .subject(subject)
        .issuer(issuer)
        .issuedAt(Date.from(issuedAt))
        .expiration(Date.from(expiresAt))
        .claim(ROLE_CLAIM_KEY, GUEST_ROLE)
        .signWith(secretKey, Jwts.SIG.HS256)
        .compact();

    return new GuestEnterResult(token, expiresAt);
  }
}
