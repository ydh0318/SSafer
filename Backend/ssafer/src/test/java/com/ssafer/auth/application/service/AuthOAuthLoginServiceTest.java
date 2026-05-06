package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.never;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AuthOAuthLoginServiceTest {

  private OAuthLoginProviderHandler googleHandler;
  private OAuthLoginProviderHandler githubHandler;
  private UserRepository userRepository;
  private AuthOAuthLoginService authOAuthLoginService;

  @BeforeEach
  void setUp() {
    googleHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    githubHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    userRepository = Mockito.mock(UserRepository.class);

    given(googleHandler.provider()).willReturn(OAuthProvider.GOOGLE);
    given(githubHandler.provider()).willReturn(OAuthProvider.GITHUB);

    authOAuthLoginService = new AuthOAuthLoginService(List.of(googleHandler, githubHandler), userRepository);
  }

  @Test
  void loginDelegatesToMatchedGoogleProviderHandlerAndMatchesExistingUser() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "User@ssafer.co.kr",
        "싸피맨"
    );
    User matchedUser = new User("user@ssafer.co.kr", "싸피맨", null, AccountStatus.ACTIVE);
    setUserId(matchedUser, 1L);

    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback")).willReturn(userInfo);
    given(userRepository.findByEmail("user@ssafer.co.kr")).willReturn(Optional.of(matchedUser));

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    );

    assertThat(result.provider()).isEqualTo(OAuthProvider.GOOGLE);
    assertThat(result.providerUserId()).isEqualTo("google-user-123");
    assertThat(result.email()).isEqualTo("user@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("싸피맨");
    assertThat(result.existingUserMatched()).isTrue();
    assertThat(result.existingUserId()).isEqualTo(1L);
    assertThat(result.existingUserAccountStatus()).isEqualTo(AccountStatus.ACTIVE);

    then(googleHandler).should().fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback");
    then(userRepository).should().findByEmail("user@ssafer.co.kr");
    then(githubHandler).should().provider();
    then(githubHandler).should(never()).fetchUserInfo(Mockito.anyString(), Mockito.anyString());
  }

  @Test
  void loginDelegatesToMatchedGithubProviderHandlerAndMatchesExistingUser() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GITHUB,
        "101",
        "github-user@ssafer.co.kr",
        "github-dev"
    );
    User matchedUser = new User("github-user@ssafer.co.kr", "깃허브사용자", null, AccountStatus.ACTIVE);
    setUserId(matchedUser, 2L);

    given(githubHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback")).willReturn(userInfo);
    given(userRepository.findByEmail("github-user@ssafer.co.kr")).willReturn(Optional.of(matchedUser));

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GITHUB,
        "auth-code",
        "http://localhost:5173/oauth/github/callback"
    );

    assertThat(result.provider()).isEqualTo(OAuthProvider.GITHUB);
    assertThat(result.providerUserId()).isEqualTo("101");
    assertThat(result.email()).isEqualTo("github-user@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("github-dev");
    assertThat(result.existingUserMatched()).isTrue();
    assertThat(result.existingUserId()).isEqualTo(2L);
    assertThat(result.existingUserAccountStatus()).isEqualTo(AccountStatus.ACTIVE);

    then(githubHandler).should().fetchUserInfo("auth-code", "http://localhost:5173/oauth/github/callback");
    then(userRepository).should().findByEmail("github-user@ssafer.co.kr");
    then(googleHandler).should(never()).fetchUserInfo(Mockito.anyString(), Mockito.anyString());
  }

  @Test
  void loginReturnsUnmatchedResultWhenExistingUserDoesNotExist() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "new-user@ssafer.co.kr",
        "새사용자"
    );

    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:5173/oauth/google/callback")).willReturn(userInfo);
    given(userRepository.findByEmail("new-user@ssafer.co.kr")).willReturn(Optional.empty());

    OAuthLoginResult result = authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    );

    assertThat(result.existingUserMatched()).isFalse();
    assertThat(result.existingUserId()).isNull();
    assertThat(result.existingUserAccountStatus()).isNull();
  }

  @Test
  void loginThrowsInternalServerErrorWhenProviderHandlerIsMissing() {
    AuthOAuthLoginService serviceWithoutGithub = new AuthOAuthLoginService(List.of(googleHandler), userRepository);

    assertThatThrownBy(() -> serviceWithoutGithub.login(
        OAuthProvider.GITHUB,
        "auth-code",
        "http://localhost:5173/oauth/github/callback"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
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
