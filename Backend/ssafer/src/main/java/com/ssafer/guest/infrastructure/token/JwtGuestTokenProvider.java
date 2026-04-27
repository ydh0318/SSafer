package com.ssafer.guest.infrastructure.token;

import com.ssafer.guest.application.service.GuestEnterResult;
import com.ssafer.guest.domain.repository.GuestTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
/**
 * 게스트 입장 시 사용할 JWT를 발급한다.
 * DB/Redis 세션 없이, 토큰 claim(guestOwnerKeyHash)만으로 프로젝트 소유권을 판별하는 구조다.
 */
public class JwtGuestTokenProvider implements GuestTokenProvider {

  private static final String GUEST_SUBJECT_PREFIX = "guest:";
  private static final String ROLE_CLAIM_KEY = "role";
  private static final String GUEST_ROLE = "GUEST";
  private static final String GUEST_OWNER_KEY_HASH_CLAIM_KEY = "guestOwnerKeyHash";

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

    // raw ownerKey는 외부로 노출하지 않고, 해시값만 claim으로 넣어 소유자 식별에 사용한다.
    String ownerKey = UUID.randomUUID().toString() + ":" + UUID.randomUUID();
    String guestOwnerKeyHash = sha256(ownerKey);

    String token = Jwts.builder()
        .subject(subject)
        .issuer(issuer)
        .issuedAt(Date.from(issuedAt))
        .expiration(Date.from(expiresAt))
        .claim(ROLE_CLAIM_KEY, GUEST_ROLE)
        .claim(GUEST_OWNER_KEY_HASH_CLAIM_KEY, guestOwnerKeyHash)
        .signWith(secretKey, Jwts.SIG.HS256)
        .compact();

    return new GuestEnterResult(token, expiresAt);
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 algorithm is not available", ex);
    }
  }
}
