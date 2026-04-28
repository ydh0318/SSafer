package com.ssafer.global.security;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtAuthenticationTokenParser {

  private static final String ROLE_CLAIM_KEY = "role";
  private static final String TOKEN_TYPE_CLAIM_KEY = "tokenType";
  private static final String ACCESS_TOKEN_TYPE = "ACCESS";
  private static final String GUEST_ROLE = "GUEST";
  private static final String GUEST_OWNER_KEY_HASH_CLAIM_KEY = "guestOwnerKeyHash";

  private final SecretKey secretKey;
  private final String issuer;

  public JwtAuthenticationTokenParser(
      @Value("${JWT_SECRET}") String jwtSecret,
      @Value("${JWT_ISSUER:ssafer}") String issuer
  ) {
    this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    this.issuer = issuer;
  }

  public AuthenticatedActor parse(String token) {
    try {
      Claims claims = Jwts.parser()
          .verifyWith(secretKey)
          .build()
          .parseSignedClaims(token)
          .getPayload();

      // 우리 서버가 발급한 토큰인지 issuer로 먼저 검증한다.
      if (!issuer.equals(claims.getIssuer())) {
        throw unauthorized();
      }

      String role = claims.get(ROLE_CLAIM_KEY, String.class);
      // guest 토큰은 guestOwnerKeyHash를 기준으로 권한 주체를 복원한다.
      if (GUEST_ROLE.equals(role)) {
        String guestOwnerKeyHash = claims.get(GUEST_OWNER_KEY_HASH_CLAIM_KEY, String.class);
        if (guestOwnerKeyHash == null || guestOwnerKeyHash.isBlank()) {
          throw unauthorized();
        }
        return AuthenticatedActor.guest(guestOwnerKeyHash);
      }

      // 회원 보호 API에는 access token만 허용해서 refresh token 오용을 막는다.
      String tokenType = claims.get(TOKEN_TYPE_CLAIM_KEY, String.class);
      if (!ACCESS_TOKEN_TYPE.equals(tokenType)) {
        throw unauthorized();
      }

      String subject = claims.getSubject();
      if (subject == null || subject.isBlank()) {
        throw unauthorized();
      }
      return AuthenticatedActor.member(Long.parseLong(subject));
    } catch (JwtException | IllegalArgumentException ex) {
      throw unauthorized();
    }
  }

  private BusinessException unauthorized() {
    return new BusinessException(ErrorCode.UNAUTHORIZED);
  }
}
