package com.ssafer.auth.infrastructure.token;

import com.ssafer.auth.application.service.OAuthRejoinTokenPayload;
import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.domain.repository.OAuthRejoinTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
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
public class JwtOAuthRejoinTokenProvider implements OAuthRejoinTokenProvider {

  private static final String TOKEN_TYPE_CLAIM_KEY = "tokenType";
  private static final String REJOIN_TOKEN_TYPE = "OAUTH_REJOIN";
  private static final String PROVIDER_CLAIM_KEY = "provider";
  private static final String PROVIDER_USER_ID_CLAIM_KEY = "providerUserId";
  private static final String EMAIL_CLAIM_KEY = "email";
  private static final String DISPLAY_NAME_CLAIM_KEY = "displayName";

  private final SecretKey secretKey;
  private final String issuer;
  private final Duration rejoinTokenTtl;

  public JwtOAuthRejoinTokenProvider(
      @Value("${JWT_SECRET}") String jwtSecret,
      @Value("${JWT_ISSUER:ssafer}") String issuer,
      @Value("${JWT_OAUTH_REJOIN_TOKEN_EXPIRES_SECONDS:600}") long rejoinTokenExpiresSeconds
  ) {
    this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    this.issuer = issuer;
    this.rejoinTokenTtl = Duration.ofSeconds(rejoinTokenExpiresSeconds);
  }

  @Override
  public String issueToken(OAuthRejoinTokenPayload payload) {
    if (payload.userId() == null || payload.userId() <= 0 || payload.provider() == null) {
      throw new IllegalArgumentException("Valid rejoin payload is required");
    }

    Instant issuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    Instant expiresAt = issuedAt.plus(rejoinTokenTtl);
    return Jwts.builder()
        .id(UUID.randomUUID().toString())
        .subject(String.valueOf(payload.userId()))
        .issuer(issuer)
        .issuedAt(Date.from(issuedAt))
        .expiration(Date.from(expiresAt))
        .claim(TOKEN_TYPE_CLAIM_KEY, REJOIN_TOKEN_TYPE)
        .claim(PROVIDER_CLAIM_KEY, payload.provider().name())
        .claim(PROVIDER_USER_ID_CLAIM_KEY, payload.providerUserId())
        .claim(EMAIL_CLAIM_KEY, payload.email())
        .claim(DISPLAY_NAME_CLAIM_KEY, payload.displayName())
        .signWith(secretKey, Jwts.SIG.HS256)
        .compact();
  }

  @Override
  public OAuthRejoinTokenPayload parseToken(String token) {
    try {
      Claims claims = Jwts.parser()
          .verifyWith(secretKey)
          .build()
          .parseSignedClaims(token)
          .getPayload();
      validateIssuer(claims);
      validateTokenType(claims);

      Long userId = extractUserId(claims.getSubject());
      OAuthProvider provider = OAuthProvider.valueOf(claims.get(PROVIDER_CLAIM_KEY, String.class));
      String providerUserId = claims.get(PROVIDER_USER_ID_CLAIM_KEY, String.class);
      String email = claims.get(EMAIL_CLAIM_KEY, String.class);
      String displayName = claims.get(DISPLAY_NAME_CLAIM_KEY, String.class);
      if (providerUserId == null || providerUserId.isBlank() || email == null || email.isBlank()) {
        throw unauthorized();
      }

      return new OAuthRejoinTokenPayload(userId, provider, providerUserId, email, displayName);
    } catch (JwtException | IllegalArgumentException ex) {
      throw unauthorized();
    }
  }

  private void validateIssuer(Claims claims) {
    if (!issuer.equals(claims.getIssuer())) {
      throw unauthorized();
    }
  }

  private void validateTokenType(Claims claims) {
    String tokenType = claims.get(TOKEN_TYPE_CLAIM_KEY, String.class);
    if (!REJOIN_TOKEN_TYPE.equals(tokenType)) {
      throw unauthorized();
    }
  }

  private Long extractUserId(String subject) {
    if (subject == null || subject.isBlank()) {
      throw unauthorized();
    }
    long userId = Long.parseLong(subject);
    if (userId <= 0) {
      throw unauthorized();
    }
    return userId;
  }

  private BusinessException unauthorized() {
    return new BusinessException(ErrorCode.UNAUTHORIZED);
  }
}
