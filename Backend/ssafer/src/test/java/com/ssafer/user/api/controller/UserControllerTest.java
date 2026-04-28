package com.ssafer.user.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.user.application.service.UserRegistrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class UserControllerTest {

  private MockMvc mockMvc;
  private UserRegistrationService userRegistrationService;

  @BeforeEach
  void setUp() {
    userRegistrationService = Mockito.mock(UserRegistrationService.class);
    UserController controller = new UserController(userRegistrationService);
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .setValidator(validator)
        .build();
  }

  @Test
  void registerReturnsCreatedUserId() throws Exception {
    given(userRegistrationService.register("test@example.com", "Alice", "password123"))
        .willReturn(1L);

    mockMvc.perform(post("/api/v1/users")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "test@example.com",
                  "displayName": "Alice",
                  "password": "password123"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.message").value("User registration succeeded"))
        .andExpect(jsonPath("$.data.userId").value(1L));
  }

  @Test
  void checkEmailReturnsAvailability() throws Exception {
    given(userRegistrationService.isEmailAvailable("test@example.com")).willReturn(true);

    mockMvc.perform(get("/api/v1/users/check-email")
            .param("email", "test@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Email availability check succeeded"))
        .andExpect(jsonPath("$.data.available").value(true));
  }

  @Test
  void registerWithoutBodyReturnsInvalidParameter() throws Exception {
    mockMvc.perform(post("/api/v1/users")
            .contentType(APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void registerWithInvalidFieldsReturnsFieldErrors() throws Exception {
    mockMvc.perform(post("/api/v1/users")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "invalid-email",
                  "displayName": "",
                  "password": "1234"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").value("올바른 이메일 형식이어야 합니다."))
        .andExpect(jsonPath("$.data.fieldErrors.displayName").value("사용자명은 필수입니다."))
        .andExpect(jsonPath("$.data.fieldErrors.password").value("비밀번호는 8자 이상 72자 이하여야 합니다."));
  }

  @Test
  void duplicateEmailReturnsConflict() throws Exception {
    given(userRegistrationService.register("test@example.com", "Alice", "password123"))
        .willThrow(new BusinessException(ErrorCode.DUPLICATE_EMAIL));

    mockMvc.perform(post("/api/v1/users")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "test@example.com",
                  "displayName": "Alice",
                  "password": "password123"
                }
                """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
  }

  @Test
  void checkEmailWithInvalidFormatReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-email")
            .param("email", "invalid-email"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").value("올바른 이메일 형식이어야 합니다."));
  }

  @Test
  void checkEmailWithoutParameterReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-email"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").value("이메일은 필수입니다."));
  }
}
