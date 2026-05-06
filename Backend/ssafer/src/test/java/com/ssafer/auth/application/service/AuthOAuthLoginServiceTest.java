package com.ssafer.auth.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.never;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AuthOAuthLoginServiceTest {

  private OAuthLoginProviderHandler googleHandler;
  private OAuthLoginProviderHandler githubHandler;
  private AuthOAuthLoginService authOAuthLoginService;

  @BeforeEach
  void setUp() {
    googleHandler = Mockito.mock(OAuthLoginProviderHandler.class);
    githubHandler = Mockito.mock(OAuthLoginProviderHandler.class);

    given(googleHandler.provider()).willReturn(OAuthProvider.GOOGLE);
    given(githubHandler.provider()).willReturn(OAuthProvider.GITHUB);

    authOAuthLoginService = new AuthOAuthLoginService(List.of(googleHandler, githubHandler));
  }

  @Test
  void loginDelegatesToMatchedProviderHandler() {
    OAuthProviderUserInfo userInfo = new OAuthProviderUserInfo(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "user@ssafer.co.kr",
        "싸피맨"
    );
    given(googleHandler.fetchUserInfo("auth-code", "http://localhost:3000/oauth/callback"))
        .willReturn(userInfo);

    OAuthProviderUserInfo result = authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:3000/oauth/callback"
    );

    assertThat(result).isEqualTo(userInfo);
    then(googleHandler).should().fetchUserInfo("auth-code", "http://localhost:3000/oauth/callback");
    then(githubHandler).should().provider();
    then(githubHandler).should(never()).fetchUserInfo(Mockito.anyString(), Mockito.anyString());
  }

  @Test
  void loginThrowsInternalServerErrorWhenProviderHandlerIsMissing() {
    AuthOAuthLoginService serviceWithoutGithub = new AuthOAuthLoginService(List.of(googleHandler));

    assertThatThrownBy(() -> serviceWithoutGithub.login(
        OAuthProvider.GITHUB,
        "auth-code",
        "http://localhost:3000/oauth/callback"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
