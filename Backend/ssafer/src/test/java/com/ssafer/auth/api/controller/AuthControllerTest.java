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
  void loginWithInvalidEmailReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "invalid-email",
                  "password": "password123!"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").exists());
  }

  @Test
  void loginWithWrongCredentialsReturnsUnauthorized() throws Exception {
    given(authLoginService.login("user@ssafer.co.kr", "password123!"))
        .willThrow(new BusinessException(ErrorCode.INVALID_CREDENTIALS));

    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr",
                  "password": "password123!"
                }
                """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
  }

  @Test
  void oauthLoginReturnsTokensAndUserInfoWhenRequestIsValid() throws Exception {
    given(authOAuthLoginService.login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    )).willReturn(new OAuthLoginResult(
        OAuthProvider.GOOGLE,
        "google-user-123",
        "user@ssafer.co.kr",
        "싸피맨",
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
        .andExpect(jsonPath("$.data.providerUserId").value("google-user-123"))
        .andExpect(jsonPath("$.data.email").value("user@ssafer.co.kr"))
        .andExpect(jsonPath("$.data.displayName").value("싸피맨"))
        .andExpect(jsonPath("$.data.newUserCreated").value(false))
        .andExpect(jsonPath("$.data.userId").value(1L))
        .andExpect(jsonPath("$.data.accountStatus").value("ACTIVE"))
        .andExpect(jsonPath("$.data.accessToken").value("access-token"))
        .andExpect(jsonPath("$.data.refreshToken").value("refresh-token"));

    then(authOAuthLoginService).should().login(
        OAuthProvider.GOOGLE,
        "auth-code",
        "http://localhost:5173/oauth/google/callback"
    );
  }

  @Test
  void oauthLoginWithMissingFieldsReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/oauth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "provider": "GOOGLE",
                  "authorizationCode": " ",
                  "redirectUri": ""
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.authorizationCode").exists())
        .andExpect(jsonPath("$.data.fieldErrors.redirectUri").exists());
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

    then(authTokenRefreshService).should().refresh("refresh-token");
  }

  @Test
  void refreshWithBlankTokenReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/refresh")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": " "
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.refreshToken").exists());
  }

  @Test
  void refreshWithInvalidTokenReturnsUnauthorized() throws Exception {
    given(authTokenRefreshService.refresh("refresh-token"))
        .willThrow(new BusinessException(ErrorCode.UNAUTHORIZED));

    mockMvc.perform(post("/api/v1/auth/refresh")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": "refresh-token"
                }
                """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
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
  void logoutWithBlankTokenReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/logout")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "refreshToken": " "
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.refreshToken").exists());
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
