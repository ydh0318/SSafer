package com.ssafer.auth.api.controller;

import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.auth.application.service.PasswordResetCodeService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class PasswordResetControllerTest {

  private MockMvc mockMvc;
  private PasswordResetCodeService passwordResetCodeService;

  @BeforeEach
  void setUp() {
    passwordResetCodeService = Mockito.mock(PasswordResetCodeService.class);
    PasswordResetController controller = new PasswordResetController(passwordResetCodeService);
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .setValidator(validator)
        .build();
  }

  @Test
  void sendCodeReturnsOk() throws Exception {
    mockMvc.perform(post("/api/v1/auth/password-reset/send-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Password reset verification code sent"))
        .andExpect(jsonPath("$.data").doesNotExist());

    then(passwordResetCodeService).should().sendResetCode("user@ssafer.co.kr");
  }

  @Test
  void sendCodeWithInvalidEmailReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/password-reset/send-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "invalid-email"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").value("올바른 이메일 형식이어야 합니다."));
  }

  @Test
  void sendCodeWhenRequestTooFrequentReturnsTooManyRequests() throws Exception {
    Mockito.doThrow(new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT))
        .when(passwordResetCodeService)
        .sendResetCode("user@ssafer.co.kr");

    mockMvc.perform(post("/api/v1/auth/password-reset/send-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr"
                }
                """))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT"));
  }
}
