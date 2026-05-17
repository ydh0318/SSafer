package com.ssafer.global.security;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtAuthenticationTokenParser {

  private static final String ROLE_CLAIM_KEY = "role";
  private static final String TOKEN_TYPE_CLAIM_KEY = "tokenType";
  private static final String TOKEN_ISSUED_AT_NANOS_CLAIM_KEY = "iatNanos";
  private static final String ACCESS_TOKEN_TYPE = "ACCESS";
  private static final String GUEST_ROLE = "GUEST";
  private static final String GUEST_OWNER_KEY_HASH_CLAIM_KEY = "guestOwnerKeyHash";

  private final SecretKey secretKey;
  private final String issuer;
  private final UserRepository userRepository;

  public JwtAuthenticationTokenParser(
      @Value("${JWT_SECRET}") String jwtSecret,
      @Value("${JWT_ISSUER:ssafer}") String issuer,
      UserRepository userRepository
  ) {
    this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    this.issuer = issuer;
    this.userRepository = userRepository;
  }

  public AuthenticatedActor parse(String token) {
    try {
      Claims claims = Jwts.parser()
          .verifyWith(secretKey)
          .build()
          .parseSignedClaims(token)
          .getPayload();

      if (!issuer.equals(claims.getIssuer())) {
        throw unauthorized();
      }

      String role = claims.get(ROLE_CLAIM_KEY, String.class);
      if (GUEST_ROLE.equals(role)) {
        String guestOwnerKeyHash = claims.get(GUEST_OWNER_KEY_HASH_CLAIM_KEY, String.class);
        if (guestOwnerKeyHash == null || guestOwnerKeyHash.isBlank()) {
          throw unauthorized();
        }
        return AuthenticatedActor.guest(guestOwnerKeyHash);
      }

      String tokenType = claims.get(TOKEN_TYPE_CLAIM_KEY, String.class);
      if (!ACCESS_TOKEN_TYPE.equals(tokenType)) {
        throw unauthorized();
      }

      String subject = claims.getSubject();
      if (subject == null || subject.isBlank()) {
        throw unauthorized();
      }

      Long userId = Long.parseLong(subject);
      User user = userRepository.findByIdAndAccountStatus(userId, AccountStatus.ACTIVE)
          .orElseThrow(this::unauthorized);

      Instant tokenIssuedAt = extractIssuedAt(claims);
      Instant tokenInvalidatedAt = user.getTokenInvalidatedAt();
      if (tokenInvalidatedAt != null && !tokenIssuedAt.isAfter(tokenInvalidatedAt)) {
        throw unauthorized();
      }

      return AuthenticatedActor.member(userId);
    } catch (JwtException | IllegalArgumentException ex) {
      throw unauthorized();
    }
  }

  private BusinessException unauthorized() {
    return new BusinessException(ErrorCode.UNAUTHORIZED);
  }

  private Instant extractIssuedAt(Claims claims) {
    String issuedAtNanos = claims.get(TOKEN_ISSUED_AT_NANOS_CLAIM_KEY, String.class);
    if (issuedAtNanos != null && !issuedAtNanos.isBlank()) {
      long epochNanos = Long.parseLong(issuedAtNanos);
      return Instant.ofEpochSecond(
          Math.floorDiv(epochNanos, 1_000_000_000L),
          Math.floorMod(epochNanos, 1_000_000_000L)
      );
    }

    Date issuedAt = claims.getIssuedAt();
    if (issuedAt == null) {
      throw unauthorized();
    }
    return issuedAt.toInstant();
  }
}
