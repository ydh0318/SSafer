package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.never;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.auth.domain.repository.AuthTokenProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.application.service.UserSocialAccountService;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class AuthOAuthLoginServiceTest {

  private OAuthLoginProviderHandler googleHandler;
  private OAuthLoginProviderHandler githubHandler;
  private UserRepository userRepository;
  private UserSocialAccountService userSocialAccountService;
  private AuthTokenProvider authTokenProvider;
  private AuthOAuthLoginService authOAuthLoginService;

  @BeforeEach
  void setUp() {
    googleHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    githubHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    userRepository = Mockito.mock(UserRepository.class);
    userSocialAccountService = Mockito.mock(UserSocialAccountService.class);
    authTokenProvider = Mockito.mock(AuthTokenProvider.class);

    given(googleHandler.provider()).willReturn(OAuthProvider.GOOGLE);
    given(githubHandler.provider()).willReturn(OAuthProvider.GITHUB);

    authOAuthLoginService = new AuthOAuthLoginService(
        List.of(googleHandler, githubHandler),
        userRepository,
        userSocialAccountService,
        authTokenProvider
    );
  }

  @Test
  void loginIssuesTokensForMatchedExistingGoogleUser() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "User@ssafer.co.kr",
        "Alice"
    );
    User matchedUser = new User("user@ssafer.co.kr", "Alice", null, AccountStatus.ACTIVE);
    setUserId(matchedUser, 1L);
    AuthTokenResult tokenResult = new AuthTokenResult(
        "access-token",
        Instant.parse("2026-05-06T12:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-20T12:00:00Z")
    );

    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback")).willReturn(userInfo);
    given(userSocialAccountService.findLinkedUser(OAuthProvider.GOOGLE, "google-user-123"))
        .willReturn(Optional.empty());
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(matchedUser));
    given(authTokenProvider.issueTokens(1L)).willReturn(tokenResult);

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    );

    assertThat(result.newUserCreated()).isFalse();
    assertThat(result.userId()).isEqualTo(1L);
    assertThat(result.accountStatus()).isEqualTo(AccountStatus.ACTIVE);
    assertThat(result.accessToken()).isEqualTo("access-token");
    assertThat(result.refreshToken()).isEqualTo("refresh-token");

    then(authTokenProvider).should().issueTokens(1L);
    then(userSocialAccountService).should().syncSocialLogin(matchedUser, userInfo);
    then(userRepository).should(never()).saveAndFlush(Mockito.any(User.class));
  }

  @Test
  void loginCreatesNewUserAndIssuesTokensWhenEmailIsNotMatched() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GITHUB,
        "101",
        "new-user@ssafer.co.kr",
        "github-user"
    );
    User createdUser = new User("new-user@ssafer.co.kr", "github-user", null, AccountStatus.ACTIVE);
    setUserId(createdUser, 2L);
    AuthTokenResult tokenResult = new AuthTokenResult(
        "access-token",
        Instant.parse("2026-05-06T12:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-20T12:00:00Z")
    );

    given(githubHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback")).willReturn(userInfo);
    given(userSocialAccountService.findLinkedUser(OAuthProvider.GITHUB, "101"))
        .willReturn(Optional.empty());
    given(userRepository.findByEmail("new-user@ssafer.co.kr")).willReturn(Optional.empty());
    given(userRepository.existsByDisplayNameAndAccountStatus("github-user", AccountStatus.ACTIVE)).willReturn(false);
    given(userRepository.saveAndFlush(Mockito.any(User.class))).willReturn(createdUser);
    given(authTokenProvider.issueTokens(2L)).willReturn(tokenResult);

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GITHUB,
        "auth-code",
        "http://localhost:5173/oauth/github/callback"
    );

    assertThat(result.newUserCreated()).isTrue();
    assertThat(result.userId()).isEqualTo(2L);
    assertThat(result.displayName()).isEqualTo("github-user");

    ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
    then(userRepository).should().saveAndFlush(userCaptor.capture());
    assertThat(userCaptor.getValue().getEmail()).isEqualTo("new-user@ssafer.co.kr");
    assertThat(userCaptor.getValue().getDisplayName()).isEqualTo("github-user");
    assertThat(userCaptor.getValue().getPasswordHash()).isNull();
    assertThat(userCaptor.getValue().getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
    then(userSocialAccountService).should().syncSocialLogin(createdUser, userInfo);
    then(authTokenProvider).should().issueTokens(2L);
  }

  @Test
  void loginRejectsNonActiveMatchedUser() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "inactive@ssafer.co.kr",
        "inactive-user"
    );
    User inactiveUser = new User("inactive@ssafer.co.kr", "inactive-user", null, AccountStatus.INACTIVE);
    setUserId(inactiveUser, 3L);

    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback")).willReturn(userInfo);
    given(userSocialAccountService.findLinkedUser(OAuthProvider.GOOGLE, "google-user-123"))
        .willReturn(Optional.empty());
    given(userRepository.findByEmail("inactive@ssafer.co.kr")).willReturn(Optional.of(inactiveUser));

    assertThatThrownBy(() -> authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNAUTHORIZED);

    then(authTokenProvider).should(never()).issueTokens(Mockito.anyLong());
  }

  @Test
  void loginThrowsInternalServerErrorWhenProviderHandlerIsMissing() {
    AuthOAuthLoginService serviceWithoutGithub = new AuthOAuthLoginService(
        List.of(googleHandler),
        userRepository,
        userSocialAccountService,
        authTokenProvider
    );

    assertThatThrownBy(() -> serviceWithoutGithub.login(
        OAuthProvider.GITHUB,
        "auth-code",
        "http://localhost:5173/oauth/github/callback"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  @Test
  void loginUsesLinkedSocialAccountBeforeEmailMatch() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "other-email@ssafer.co.kr",
        "Linked User"
    );
    User linkedUser = new User("user@ssafer.co.kr", "Alice", null, AccountStatus.ACTIVE);
    setUserId(linkedUser, 9L);
    AuthTokenResult tokenResult = new AuthTokenResult(
        "access-token",
        Instant.parse("2026-05-06T12:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-20T12:00:00Z")
    );

    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback")).willReturn(userInfo);
    given(userSocialAccountService.findLinkedUser(OAuthProvider.GOOGLE, "google-user-123"))
        .willReturn(Optional.of(linkedUser));
    given(authTokenProvider.issueTokens(9L)).willReturn(tokenResult);

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    );

    assertThat(result.userId()).isEqualTo(9L);
    assertThat(result.newUserCreated()).isFalse();
    then(userRepository).should(never()).findByEmail(Mockito.anyString());
    then(userSocialAccountService).should().syncSocialLogin(linkedUser, userInfo);
  }

  private void setUserId(User user, Long id) {
    try {
      java.lang.reflect.Field field = User.class.getDeclaredField("id");
      field.setAccessible(true);
      field.set(user, id);
    } catch (ReflectiveOperationException ex) {
      throw new IllegalStateException(ex);
    }
  }
}
