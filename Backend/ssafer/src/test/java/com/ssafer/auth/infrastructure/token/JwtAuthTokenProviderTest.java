package com.ssafer.auth.infrastructure.token;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class JwtAuthTokenProviderTest {

  private static final String SECRET = "this-is-a-very-secure-jwt-secret-key-2026";
  private static final long ACCESS_TOKEN_EXPIRES_SECONDS = 900;
  private static final long REFRESH_TOKEN_EXPIRES_SECONDS = 1209600;

  @Test
  void issueTokensContainsExpectedClaimsAndExpiration() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
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
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        Mockito.mock(RefreshTokenStore.class),
        Mockito.mock(UserRepository.class)
    );

    assertThatThrownBy(() -> provider.issueTokens(0L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("userId must be a positive number");
  }

  @Test
  void issueTokensThrowsUnauthorizedWhenUserIsInactive() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    UserRepository userRepository = Mockito.mock(UserRepository.class);
    given(userRepository.existsByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(false);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
    );

    assertThatThrownBy(() -> provider.issueTokens(1L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }

  @Test
  void reissueTokensRotatesTokensWhenStoredRefreshTokenMatches() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
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
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
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
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
    );
    AuthTokenResult issued = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of(issued.refreshToken()));

    provider.revokeRefreshToken(issued.refreshToken());

    then(refreshTokenStore).should().delete(1L);
  }

  @Test
  void revokeRefreshTokenThrowsUnauthorizedWhenStoredRefreshTokenDoesNotMatch() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
    );
    AuthTokenResult issued = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L)).willReturn(java.util.Optional.of("another-refresh-token"));

    assertThatThrownBy(() -> provider.revokeRefreshToken(issued.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
  }

  @Test
  void reissueTokensThrowsUnauthorizedAfterLogoutRevokesStoredRefreshToken() {
    RefreshTokenStore refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    UserRepository userRepository = activeUserRepository(1L);
    JwtAuthTokenProvider provider = new JwtAuthTokenProvider(
        SECRET,
        "ssafer",
        ACCESS_TOKEN_EXPIRES_SECONDS,
        REFRESH_TOKEN_EXPIRES_SECONDS,
        refreshTokenStore,
        userRepository
    );
    AuthTokenResult issued = provider.issueTokens(1L);
    given(refreshTokenStore.findByUserId(1L))
        .willReturn(java.util.Optional.of(issued.refreshToken()))
        .willReturn(java.util.Optional.empty());

    provider.revokeRefreshToken(issued.refreshToken());

    assertThatThrownBy(() -> provider.reissueTokens(issued.refreshToken()))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);
    then(refreshTokenStore).should().delete(1L);
  }

  private UserRepository activeUserRepository(Long userId) {
    UserRepository userRepository = Mockito.mock(UserRepository.class);
    given(userRepository.existsByIdAndAccountStatus(userId, AccountStatus.ACTIVE)).willReturn(true);
    return userRepository;
  }
}
