package com.ssafer.auth.api.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.auth.application.service.AuthLoginService;
import com.ssafer.auth.application.service.AuthTokenRefreshService;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
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
  private AuthTokenRefreshService authTokenRefreshService;

  @BeforeEach
  void setUp() {
    authLoginService = Mockito.mock(AuthLoginService.class);
    authTokenRefreshService = Mockito.mock(AuthTokenRefreshService.class);
    AuthController controller = new AuthController(authLoginService, authTokenRefreshService);
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
}
