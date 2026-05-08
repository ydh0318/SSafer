package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.application.service.OAuthLoginProviderHandler;
import com.ssafer.auth.application.service.OAuthProviderUserInfo;
import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.entity.UserSocialAccount;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import com.ssafer.user.domain.repository.UserSocialAccountRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class UserSocialAccountServiceTest {

  private OAuthLoginProviderHandler googleHandler;
  private OAuthLoginProviderHandler githubHandler;
  private UserRepository userRepository;
  private UserSocialAccountRepository userSocialAccountRepository;
  private UserSocialAccountService userSocialAccountService;

  @BeforeEach
  void setUp() {
    googleHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    githubHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    userRepository = Mockito.mock(UserRepository.class);
    userSocialAccountRepository = Mockito.mock(UserSocialAccountRepository.class);

    given(googleHandler.provider()).willReturn(OAuthProvider.GOOGLE);
    given(githubHandler.provider()).willReturn(OAuthProvider.GITHUB);

    userSocialAccountService = new UserSocialAccountService(
        List.of(googleHandler, githubHandler),
        userRepository,
        userSocialAccountRepository
    );
  }

  @Test
  void getCurrentUserSocialAccountsReturnsSupportedProviderStatuses() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-password");
    UserSocialAccount googleAccount = createSocialAccount(
        10L,
        1L,
        OAuthProvider.GOOGLE,
        "google-123",
        "user@gmail.com",
        Instant.parse("2026-05-07T00:00:00Z")
    );
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userSocialAccountRepository.findAllByUserId(1L)).willReturn(List.of(googleAccount));

    List<UserSocialAccountResult> result = userSocialAccountService.getCurrentUserSocialAccounts(
        AuthenticatedActor.member(1L)
    );

    assertThat(result).hasSize(2);
    assertThat(result.get(0).provider()).isEqualTo(OAuthProvider.GOOGLE);
    assertThat(result.get(0).connected()).isTrue();
    assertThat(result.get(0).email()).isEqualTo("user@gmail.com");
    assertThat(result.get(1).provider()).isEqualTo(OAuthProvider.GITHUB);
    assertThat(result.get(1).connected()).isFalse();
  }

  @Test
  void connectCurrentUserSocialAccountLinksFetchedOAuthAccount() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-password");
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GITHUB,
        "github-123",
        "user@github.com",
        "Alice GitHub"
    );
    UserSocialAccount linkedAccount = createSocialAccount(
        20L,
        1L,
        OAuthProvider.GITHUB,
        "github-123",
        "user@github.com",
        Instant.parse("2026-05-07T00:00:00Z")
    );

    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userSocialAccountRepository.findByUserIdAndProvider(1L, OAuthProvider.GITHUB)).willReturn(Optional.empty());
    given(githubHandler.fetchUserInfo("github-code", "http://localhost:5173/oauth/github/callback")).willReturn(userInfo);
    given(userSocialAccountRepository.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "github-123"))
        .willReturn(Optional.empty());
    given(userSocialAccountRepository.saveAndFlush(Mockito.any(UserSocialAccount.class))).willReturn(linkedAccount);

    UserSocialAccountResult result = userSocialAccountService.connectCurrentUserSocialAccount(
        AuthenticatedActor.member(1L),
        OAuthProvider.GITHUB,
        "github-code",
        "http://localhost:5173/oauth/github/callback"
    );

    assertThat(result.provider()).isEqualTo(OAuthProvider.GITHUB);
    assertThat(result.connected()).isTrue();
    assertThat(result.email()).isEqualTo("user@github.com");
  }

  @Test
  void connectCurrentUserSocialAccountThrowsConflictWhenProviderAlreadyLinkedForUser() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-password");
    UserSocialAccount linkedAccount = createSocialAccount(
        20L,
        1L,
        OAuthProvider.GOOGLE,
        "google-123",
        "user@gmail.com",
        Instant.parse("2026-05-07T00:00:00Z")
    );
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userSocialAccountRepository.findByUserIdAndProvider(1L, OAuthProvider.GOOGLE))
        .willReturn(Optional.of(linkedAccount));

    assertThatThrownBy(() -> userSocialAccountService.connectCurrentUserSocialAccount(
        AuthenticatedActor.member(1L),
        OAuthProvider.GOOGLE,
        "google-code",
        "http://localhost:5173/oauth/google/callback"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SOCIAL_ACCOUNT_ALREADY_LINKED);
  }

  @Test
  void disconnectCurrentUserSocialAccountThrowsWhenItIsLastSignInMethod() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", null);
    UserSocialAccount linkedAccount = createSocialAccount(
        20L,
        1L,
        OAuthProvider.GOOGLE,
        "google-123",
        "user@gmail.com",
        Instant.parse("2026-05-07T00:00:00Z")
    );
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userSocialAccountRepository.findByUserIdAndProvider(1L, OAuthProvider.GOOGLE))
        .willReturn(Optional.of(linkedAccount));
    given(userSocialAccountRepository.countByUserId(1L)).willReturn(1L);

    assertThatThrownBy(() -> userSocialAccountService.disconnectCurrentUserSocialAccount(
        AuthenticatedActor.member(1L),
        OAuthProvider.GOOGLE
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED);
  }

  @Test
  void syncSocialLoginCreatesLinkWhenNoLinkExists() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", null);
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-123",
        "user@gmail.com",
        "Alice"
    );
    UserSocialAccount linkedAccount = createSocialAccount(
        20L,
        1L,
        OAuthProvider.GOOGLE,
        "google-123",
        "user@gmail.com",
        Instant.parse("2026-05-07T00:00:00Z")
    );

    given(userSocialAccountRepository.findByUserIdAndProvider(1L, OAuthProvider.GOOGLE)).willReturn(Optional.empty());
    given(userSocialAccountRepository.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "google-123"))
        .willReturn(Optional.empty());
    given(userSocialAccountRepository.saveAndFlush(Mockito.any(UserSocialAccount.class))).willReturn(linkedAccount);

    userSocialAccountService.syncSocialLogin(user, userInfo);

    then(userSocialAccountRepository).should().saveAndFlush(Mockito.any(UserSocialAccount.class));
  }

  private User createUser(Long userId, String email, String displayName, String passwordHash) {
    User user = new User(email, displayName, passwordHash, AccountStatus.ACTIVE);
    ReflectionTestUtils.setField(user, "id", userId);
    return user;
  }

  private UserSocialAccount createSocialAccount(
      Long id,
      Long userId,
      OAuthProvider provider,
      String providerUserId,
      String socialEmail,
      Instant createdAt
  ) {
    UserSocialAccount account = new UserSocialAccount(userId, provider, providerUserId, socialEmail);
    ReflectionTestUtils.setField(account, "id", id);
    ReflectionTestUtils.setField(account, "createdAt", createdAt);
    ReflectionTestUtils.setField(account, "updatedAt", createdAt);
    return account;
  }
}
