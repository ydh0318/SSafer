package com.ssafer.auth.infrastructure.token;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtAuthTokenProvider implements AuthTokenProvider {

  private static final String TOKEN_TYPE_CLAIM_KEY = "tokenType";
  private static final String ACCESS_TOKEN_TYPE = "ACCESS";
  private static final String REFRESH_TOKEN_TYPE = "REFRESH";

  private final SecretKey secretKey;
  private final String issuer;
  private final Duration accessTokenTtl;
  private final Duration refreshTokenTtl;
  private final RefreshTokenStore refreshTokenStore;

  public JwtAuthTokenProvider(
      @Value("${JWT_SECRET}") String jwtSecret,
      @Value("${JWT_ISSUER:ssafer}") String issuer,
      @Value("${JWT_ACCESS_TOKEN_EXPIRES_SECONDS:7200}") long accessTokenExpiresSeconds,
      @Value("${JWT_REFRESH_TOKEN_EXPIRES_SECONDS:1209600}") long refreshTokenExpiresSeconds,
      RefreshTokenStore refreshTokenStore
  ) {
    this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    this.issuer = issuer;
    this.accessTokenTtl = Duration.ofSeconds(accessTokenExpiresSeconds);
    this.refreshTokenTtl = Duration.ofSeconds(refreshTokenExpiresSeconds);
    this.refreshTokenStore = refreshTokenStore;
  }

  @Override
  public AuthTokenResult issueTokens(Long userId) {
    if (userId == null || userId <= 0) {
      throw new IllegalArgumentException("userId must be a positive number");
    }

    // access/refresh token 기준 시각을 맞추면 응답과 테스트가 단순해진다.
    Instant issuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    Instant accessTokenExpiresAt = issuedAt.plus(accessTokenTtl);
    Instant refreshTokenExpiresAt = issuedAt.plus(refreshTokenTtl);
    String subject = String.valueOf(userId);

    String accessToken = buildToken(subject, issuedAt, accessTokenExpiresAt, ACCESS_TOKEN_TYPE);
    String refreshToken = buildToken(subject, issuedAt, refreshTokenExpiresAt, REFRESH_TOKEN_TYPE);
    // 로그인과 재발급 시점마다 마지막 refresh token만 유효하도록 Redis 값을 갱신한다.
    refreshTokenStore.save(userId, refreshToken, refreshTokenTtl);

    return new AuthTokenResult(
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt
    );
  }

  @Override
  public AuthTokenResult reissueTokens(String refreshToken) {
    try {
      Long userId = validateActiveRefreshTokenAndGetUserId(refreshToken);
      return issueTokens(userId);
    } catch (JwtException | IllegalArgumentException ex) {
      throw unauthorized();
    }
  }

  @Override
  public void revokeRefreshToken(String refreshToken) {
    try {
      Long userId = validateActiveRefreshTokenAndGetUserId(refreshToken);
      refreshTokenStore.delete(userId);
    } catch (JwtException | IllegalArgumentException ex) {
      throw unauthorized();
    }
  }

  private Long validateActiveRefreshTokenAndGetUserId(String refreshToken) {
    Claims claims = parseClaims(refreshToken);
    validateIssuer(claims);

    String tokenType = claims.get(TOKEN_TYPE_CLAIM_KEY, String.class);
    if (!REFRESH_TOKEN_TYPE.equals(tokenType)) {
      throw unauthorized();
    }

    Long userId = extractUserId(claims.getSubject());
    String savedRefreshToken = refreshTokenStore.findByUserId(userId)
        .orElseThrow(this::unauthorized);

    // 재발급과 로그아웃 모두 현재 Redis에 저장된 활성 refresh token에 대해서만 허용한다.
    if (!MessageDigest.isEqual(
        savedRefreshToken.getBytes(StandardCharsets.UTF_8),
        refreshToken.getBytes(StandardCharsets.UTF_8)
    )) {
      throw unauthorized();
    }
    return userId;
  }

  private String buildToken(String subject, Instant issuedAt, Instant expiresAt, String tokenType) {
    // 로그인 후 access/refresh를 명확히 구분할 수 있도록 tokenType claim을 함께 넣는다.
    return Jwts.builder()
        // 같은 초에 재발급이 일어나도 새 토큰 문자열이 되도록 고유 ID를 넣는다.
        .id(UUID.randomUUID().toString())
        .subject(subject)
        .issuer(issuer)
        .issuedAt(Date.from(issuedAt))
        .expiration(Date.from(expiresAt))
        .claim(TOKEN_TYPE_CLAIM_KEY, tokenType)
        .signWith(secretKey, Jwts.SIG.HS256)
        .compact();
  }

  private Claims parseClaims(String token) {
    return Jwts.parser()
        .verifyWith(secretKey)
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }

  private void validateIssuer(Claims claims) {
    if (!issuer.equals(claims.getIssuer())) {
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
