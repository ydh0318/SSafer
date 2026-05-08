package com.ssafer.auth.api.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.auth.application.service.AuthLoginService;
import com.ssafer.auth.application.service.AuthLogoutService;
import com.ssafer.auth.application.service.AuthOAuthLoginService;
import com.ssafer.auth.application.service.AuthTokenRefreshService;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.application.service.OAuthLoginResult;
import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.error.RejoinRequiredException;
import com.ssafer.user.domain.enums.AccountStatus;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class AuthControllerTest {

  private MockMvc mockMvc;
  private AuthLoginService authLoginService;
  private AuthOAuthLoginService authOAuthLoginService;
  private AuthTokenRefreshService authTokenRefreshService;
  private AuthLogoutService authLogoutService;

  @BeforeEach
  void setUp() {
    authLoginService = Mockito.mock(AuthLoginService.class);
    authOAuthLoginService = Mockito.mock(AuthOAuthLoginService.class);
    authTokenRefreshService = Mockito.mock(AuthTokenRefreshService.class);
    authLogoutService = Mockito.mock(AuthLogoutService.class);
    AuthController controller = new AuthController(
        authLoginService,
        authOAuthLoginService,
        authTokenRefreshService,
        authLogoutService
    );
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .setValidator(validator)
        .build();
  }

  @Test
  void loginReturnsTokensWhenCredentialsAreValid() throws Exception {
    given(authLoginService.login("user@ssafer.co.kr", "password123!"))
        .willReturn(new AuthTokenResult(
            "access-token",
            Instant.parse("2026-04-29T00:00:00Z"),
            "refresh-token",
            Instant.parse("2026-05-13T00:00:00Z")
        ));

    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr",
                  "password": "password123!"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Login succeeded"))
        .andExpect(jsonPath("$.data.accessToken").value("access-token"))
        .andExpect(jsonPath("$.data.refreshToken").value("refresh-token"));

    then(authLoginService).should().login("user@ssafer.co.kr", "password123!");
  }

  @Test
  void oauthLoginReturnsTokensAndUserInfoWhenRequestIsValid() throws Exception {
    given(authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback",
        false,
        null
    )).willReturn(new OAuthLoginResult(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "user@ssafer.co.kr",
        "Alice",
        false,
        1L,
        AccountStatus.ACTIVE,
        "access-token",
        Instant.parse("2026-05-06T12:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-20T12:00:00Z")
    ));

    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "authorizationCode": "auth-code",
                  "redirectUri": "http://localhost:5173/oauth/google/callback"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("OAuth login succeeded"))
        .andExpect(jsonPath("$.data.provider").value("GOOGLE"))
        .andExpect(jsonPath("$.data.userId").value(1L));

    then(authOAuthLoginService).should().login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback",
        false,
        null
    );
  }

  @Test
  void oauthLoginWithoutAuthorizationCodeReturnsBadRequest() throws Exception {
    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "redirectUri": "http://localhost:5173/oauth/google/callback"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void oauthLoginReturnsConflictWithRejoinTokenWhenConfirmationIsRequired() throws Exception {
    given(authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback",
        false,
        null
    )).willThrow(new RejoinRequiredException("rejoin-token"));

    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "authorizationCode": "auth-code",
                  "redirectUri": "http://localhost:5173/oauth/google/callback"
                }
                """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REJOIN_REQUIRED"))
        .andExpect(jsonPath("$.data.rejoinToken").value("rejoin-token"));
  }

  @Test
  void oauthLoginUsesRejoinTokenWhenConfirmationIsRequested() throws Exception {
    given(authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        null,
        null,
        true,
        "rejoin-token"
    )).willReturn(new OAuthLoginResult(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "user@ssafer.co.kr",
        "Alice",
        false,
        1L,
        AccountStatus.ACTIVE,
        "access-token",
        Instant.parse("2026-05-06T12:00:00Z"),
        "refresh-token",
        Instant.parse("2026-05-20T12:00:00Z")
    ));

    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "confirmRejoin": true,
                  "rejoinToken": "rejoin-token"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.userId").value(1L));

    then(authOAuthLoginService).should().login(
        OAuthProvider.GOOGLE,
        null,
        null,
        true,
        "rejoin-token"
    );
  }

  @Test
  void oauthLoginWithConfirmRejoinWithoutTokenReturnsBadRequest() throws Exception {
    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "confirmRejoin": true
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void refreshReturnsTokensWhenRefreshTokenIsValid() throws Exception {
    given(authTokenRefreshService.refresh("refresh-token"))
        .willReturn(new AuthTokenResult(
            "new-access-token",
            Instant.parse("2026-04-29T00:00:00Z"),
            "new-refresh-token",
            Instant.parse("2026-05-13T00:00:00Z")
        ));

    mockMvc.perform(post("/api/v1/auth/refresh")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": "refresh-token"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Token refresh succeeded"))
        .andExpect(jsonPath("$.data.accessToken").value("new-access-token"))
        .andExpect(jsonPath("$.data.refreshToken").value("new-refresh-token"));
  }

  @Test
  void logoutReturnsSuccessWhenRefreshTokenIsValid() throws Exception {
    mockMvc.perform(post("/api/v1/auth/logout")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": "refresh-token"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Logout succeeded"));

    then(authLogoutService).should().logout("refresh-token");
  }

  @Test
  void logoutWithInvalidTokenReturnsUnauthorized() throws Exception {
    Mockito.doThrow(new BusinessException(ErrorCode.UNAUTHORIZED))
        .when(authLogoutService)
        .logout("refresh-token");

    mockMvc.perform(post("/api/v1/auth/logout")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": "refresh-token"
                }
                """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}
