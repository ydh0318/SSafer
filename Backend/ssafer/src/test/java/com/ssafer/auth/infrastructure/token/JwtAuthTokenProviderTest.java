package com.ssafer.auth.infrastructure.token;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class JwtAuthTokenProviderTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";

  @Test
  void issueTokensContainsExpectedClaimsAndExpiration() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        refreshTokenStore
    );

    AuthTokenResult result = provider.issueTokens(1L);

    Claims accessClaims = Jwts.parser()
        .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
        .build()
        .parseSignedClaims(result.accessToken())
        .getPayload();
    Claims refreshClaims = Jwts.parser()
        .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
        .build()
        .parseSignedClaims(result.refreshToken())
        .getPayload();

    assertThat(accessClaims.getSubject()).isEqualTo("1");
    assertThat(accessClaims.getIssuer()).isEqualTo("ssafer");
    assertThat(accessClaims.get("tokenType", String.class)).isEqualTo("ACCESS");
    assertThat(accessClaims.getExpiration().toInstant()).isEqualTo(result.accessTokenExpiresAt());

    assertThat(refreshClaims.getSubject()).isEqualTo("1");
    assertThat(refreshClaims.getIssuer()).isEqualTo("ssafer");
    assertThat(refreshClaims.get("tokenType", String.class)).isEqualTo("REFRESH");
    assertThat(refreshClaims.getExpiration().toInstant()).isEqualTo(result.refreshTokenExpiresAt());

    assertThat(result.refreshTokenExpiresAt()).isAfter(result.accessTokenExpiresAt());
    then(refreshTokenStore).should().save(1L, result.refreshToken(), Duration.ofDays(14));
  }

  @Test
  void issueTokensThrowsWhenUserIdIsInvalid() {
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        Mockito.mock(RefreshTokenStore.class)
    );

    assertThatThrownBy(() -> provider.issueTokens(0L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("userId must be a positive number");
  }

  @Test
  void reissueTokensRotatesTokensWhenStoredRefreshTokenMatches() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        refreshTokenStore
    );
    AuthTokenResult firstIssue = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of(firstIssue.refreshToken()));

    AuthTokenResult reissued = provider.reissueTokens(firstIssue.refreshToken());

    assertThat(reissued.accessToken()).isNotBlank();
    assertThat(reissued.refreshToken()).isNotBlank();
    assertThat(reissued.refreshToken()).isNotEqualTo(firstIssue.refreshToken());
    then(refreshTokenStore).should().findByUserId(1L);
    then(refreshTokenStore).should().save(1L, reissued.refreshToken(), Duration.ofDays(14));
  }

  @Test
  void reissueTokensThrowsUnauthorizedWhenStoredRefreshTokenDoesNotMatch() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        refreshTokenStore
    );
    AuthTokenResult firstIssue = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of("another-refresh-token"));

    assertThatThrownBy(() -> provider.reissueTokens(firstIssue.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }

  @Test
  void revokeRefreshTokenDeletesStoredRefreshTokenWhenItMatches() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        refreshTokenStore
    );
    AuthTokenResult issued = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of(issued.refreshToken()));

    provider.revokeRefreshToken(issued.refreshToken());

    then(refreshTokenStore).should().delete(1L);
  }

  @Test
  void revokeRefreshTokenThrowsUnauthorizedWhenStoredRefreshTokenDoesNotMatch() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        7200,
        1209600,
        refreshTokenStore
    );
    AuthTokenResult issued = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of("another-refresh-token"));

    assertThatThrownBy(() -> provider.revokeRefreshToken(issued.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }
}
