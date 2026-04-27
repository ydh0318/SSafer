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
/**
 * Bearer JWT를 검증하고, 프로젝트 권한 판별에 바로 쓸 수 있는 AuthenticatedActor로 변환한다.
 */
public class JwtAuthenticationTokenParser {

  private static final String ROLE_CLAIM_KEY = "role";
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

      // 우리 서버가 발급한 토큰인지 issuer로 1차 검증
      if (!issuer.equals(claims.getIssuer())) {
        throw unauthorized();
      }

      String role = claims.get(ROLE_CLAIM_KEY, String.class);
      // role=GUEST면 guestOwnerKeyHash로 게스트 소유권을 판별한다.
      if (GUEST_ROLE.equals(role)) {
        String guestOwnerKeyHash = claims.get(GUEST_OWNER_KEY_HASH_CLAIM_KEY, String.class);
        if (guestOwnerKeyHash == null || guestOwnerKeyHash.isBlank()) {
          throw unauthorized();
        }
        return AuthenticatedActor.guest(guestOwnerKeyHash);
      }

      // 일반 회원 토큰은 sub를 userId로 사용한다.
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
