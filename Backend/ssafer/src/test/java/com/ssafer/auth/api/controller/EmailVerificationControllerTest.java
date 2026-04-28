package com.ssafer.auth.api.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.auth.application.service.EmailVerificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class EmailVerificationControllerTest {

  private MockMvc mockMvc;
  private EmailVerificationService emailVerificationService;

  @BeforeEach
  void setUp() {
    emailVerificationService = Mockito.mock(EmailVerificationService.class);
    EmailVerificationController controller = new EmailVerificationController(emailVerificationService);
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .setValidator(validator)
        .build();
  }

  @Test
  void sendCodeReturnsOk() throws Exception {
    mockMvc.perform(post("/api/v1/auth/email/send-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("이메일 인증 코드 전송 성공"))
        .andExpect(jsonPath("$.data").doesNotExist());

    then(emailVerificationService).should().sendVerificationCode("user@ssafer.co.kr");
  }

  @Test
  void sendCodeWithInvalidEmailReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/email/send-code")
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
    org.mockito.BDDMockito.willThrow(
        new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT)
    ).given(emailVerificationService).sendVerificationCode("user@ssafer.co.kr");

    mockMvc.perform(post("/api/v1/auth/email/send-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr"
                }
                """))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT"));
  }

  @Test
  void verifyCodeReturnsOk() throws Exception {
    mockMvc.perform(post("/api/v1/auth/email/verify-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr",
                  "code": "123456"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("이메일 인증 성공"))
        .andExpect(jsonPath("$.data").doesNotExist());

    then(emailVerificationService).should().verifyCode("user@ssafer.co.kr", "123456");
  }

  @Test
  void verifyCodeWithInvalidCodeReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/auth/email/verify-code")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "user@ssafer.co.kr",
                  "code": "12ab"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.code").value("인증 코드는 6자리 숫자여야 합니다."));
  }
}
