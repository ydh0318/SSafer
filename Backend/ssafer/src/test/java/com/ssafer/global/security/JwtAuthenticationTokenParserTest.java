package com.ssafer.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import org.junit.jupiter.api.Test;

class JwtAuthenticationTokenParserTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";

  @Test
  void parseMemberTokenFromSubClaim() {
    JwtAuthenticationTokenParser parser = new JwtAuthenticationTokenParser(SECRET, "ssafer");
    String token = Jwts.builder()
        .subject("123")
        .issuer("ssafer")
        .issuedAt(Date.from(Instant.now().truncatedTo(ChronoUnit.SECONDS)))
        .expiration(Date.from(Instant.now().plusSeconds(60)))
        .claim("tokenType", "ACCESS")
        .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
        .compact();

    AuthenticatedActor actor = parser.parse(token);

    assertThat(actor.isMember()).isTrue();
    assertThat(actor.userId()).isEqualTo(123L);
    assertThat(actor.guestOwnerKeyHash()).isNull();
  }

  @Test
  void parseGuestTokenFromGuestOwnerKeyHashClaim() {
    JwtAuthenticationTokenParser parser = new JwtAuthenticationTokenParser(SECRET, "ssafer");
    String token = Jwts.builder()
        .subject("guest:test")
        .issuer("ssafer")
        .issuedAt(Date.from(Instant.now().truncatedTo(ChronoUnit.SECONDS)))
        .expiration(Date.from(Instant.now().plusSeconds(60)))
        .claim("role", "GUEST")
        .claim("guestOwnerKeyHash", "abcd")
        .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
        .compact();

    AuthenticatedActor actor = parser.parse(token);

    assertThat(actor.isGuest()).isTrue();
    assertThat(actor.guestOwnerKeyHash()).isEqualTo("abcd");
    assertThat(actor.userId()).isNull();
  }

  @Test
  void invalidTokenThrowsUnauthorized() {
    JwtAuthenticationTokenParser parser = new JwtAuthenticationTokenParser(SECRET, "ssafer");

    assertThatThrownBy(() -> parser.parse("invalid-token"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }

  @Test
  void refreshTokenCannotAuthenticateProtectedApi() {
    JwtAuthenticationTokenParser parser = new JwtAuthenticationTokenParser(SECRET, "ssafer");
    String token = Jwts.builder()
        .subject("123")
        .issuer("ssafer")
        .issuedAt(Date.from(Instant.now().truncatedTo(ChronoUnit.SECONDS)))
        .expiration(Date.from(Instant.now().plusSeconds(60)))
        .claim("tokenType", "REFRESH")
        .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
        .compact();

    assertThatThrownBy(() -> parser.parse(token))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }
}
