package com.ssafer.user.api.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.application.service.UserProfileResult;
import com.ssafer.user.application.service.UserProfileService;
import com.ssafer.user.application.service.UserRegistrationService;
import com.ssafer.user.application.service.UserWithdrawalService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class UserControllerTest {

  private MockMvc mockMvc;
  private CurrentActorProvider currentActorProvider;
  private UserRegistrationService userRegistrationService;
  private UserProfileService userProfileService;
  private UserPasswordService userPasswordService;
  private UserWithdrawalService userWithdrawalService;

  @BeforeEach
  void setUp() {
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    userRegistrationService = Mockito.mock(UserRegistrationService.class);
    userProfileService = Mockito.mock(UserProfileService.class);
    userPasswordService = Mockito.mock(UserPasswordService.class);
    userWithdrawalService = Mockito.mock(UserWithdrawalService.class);
    UserController controller = new UserController(
        currentActorProvider,
        userRegistrationService,
        userProfileService,
        userPasswordService,
        userWithdrawalService
    );
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
  void checkNicknameReturnsAvailability() throws Exception {
    given(userRegistrationService.isDisplayNameAvailable("ssafer-user")).willReturn(true);

    mockMvc.perform(get("/api/v1/users/check-nickname")
            .param("nickname", "ssafer-user"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Nickname availability check succeeded"))
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
        .andExpect(jsonPath("$.data.fieldErrors.email").exists())
        .andExpect(jsonPath("$.data.fieldErrors.displayName").exists())
        .andExpect(jsonPath("$.data.fieldErrors.password").exists());
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
  void duplicateNicknameOnRegisterReturnsConflict() throws Exception {
    given(userRegistrationService.register("test@example.com", "Alice", "password123"))
        .willThrow(new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME));

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
        .andExpect(jsonPath("$.code").value("DUPLICATE_DISPLAY_NAME"));
  }

  @Test
  void checkEmailWithInvalidFormatReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-email")
            .param("email", "invalid-email"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").exists());
  }

  @Test
  void checkEmailWithoutParameterReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-email"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.email").exists());
  }

  @Test
  void checkNicknameWithBlankNicknameReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-nickname")
            .param("nickname", " "))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.nickname").exists());
  }

  @Test
  void checkNicknameWithoutParameterReturnsFieldErrors() throws Exception {
    mockMvc.perform(get("/api/v1/users/check-nickname"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.nickname").exists());
  }

  @Test
  void getCurrentUserProfileReturnsProfileForAuthenticatedMember() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(userProfileService.getCurrentUserProfile(actor))
        .willReturn(new UserProfileResult("user@ssafer.co.kr", "Alice"));

    mockMvc.perform(get("/api/v1/users/me"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("User profile retrieval succeeded"))
        .andExpect(jsonPath("$.data.email").value("user@ssafer.co.kr"))
        .andExpect(jsonPath("$.data.displayName").value("Alice"));
  }

  @Test
  void updateCurrentUserProfileReturnsUpdatedProfile() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(userProfileService.updateCurrentUserProfile(actor, "Alice Updated"))
        .willReturn(new UserProfileResult("user@ssafer.co.kr", "Alice Updated"));

    mockMvc.perform(patch("/api/v1/users/me/profile")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "displayName": "Alice Updated"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("User profile update succeeded"))
        .andExpect(jsonPath("$.data.email").value("user@ssafer.co.kr"))
        .andExpect(jsonPath("$.data.displayName").value("Alice Updated"));
  }

  @Test
  void updateCurrentUserProfileWithoutBodyReturnsInvalidParameter() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/profile")
            .contentType(APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void updateCurrentUserProfileWithBlankDisplayNameReturnsFieldErrors() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/profile")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "displayName": " "
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.displayName").exists());
  }

  @Test
  void updateCurrentUserProfileWithTooLongDisplayNameReturnsFieldErrors() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/profile")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "displayName": "%s"
                }
                """.formatted("a".repeat(101))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.displayName").exists());
  }

  @Test
  void updateCurrentUserProfileReturnsConflictWhenNicknameIsDuplicated() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(userProfileService.updateCurrentUserProfile(actor, "Alice Updated"))
        .willThrow(new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME));

    mockMvc.perform(patch("/api/v1/users/me/profile")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "displayName": "Alice Updated"
                }
                """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_DISPLAY_NAME"));
  }

  @Test
  void getCurrentUserProfileReturnsForbiddenForGuest() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-hash");
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(userProfileService.getCurrentUserProfile(actor))
        .willThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(get("/api/v1/users/me"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    then(userProfileService).should().getCurrentUserProfile(actor);
  }

  @Test
  void updateCurrentUserPasswordReturnsSuccess() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(userPasswordService.changePassword(actor, "password123", "new-password123"))
        .willReturn(new AuthTokenResult(
            "new-access-token",
            Instant.parse("2026-04-29T07:00:00Z"),
            "new-refresh-token",
            Instant.parse("2026-05-13T07:00:00Z")
        ));

    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": "password123",
                  "newPassword": "new-password123"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Password change succeeded"))
        .andExpect(jsonPath("$.data.accessToken").value("new-access-token"))
        .andExpect(jsonPath("$.data.refreshToken").value("new-refresh-token"));

    then(userPasswordService).should().changePassword(actor, "password123", "new-password123");
  }

  @Test
  void updateCurrentUserPasswordWithoutBodyReturnsInvalidParameter() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void updateCurrentUserPasswordWithBlankCurrentPasswordReturnsFieldErrors() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": " ",
                  "newPassword": "new-password123"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.currentPassword").exists());
  }

  @Test
  void updateCurrentUserPasswordWithShortNewPasswordReturnsFieldErrors() throws Exception {
    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": "password123",
                  "newPassword": "short"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.data.fieldErrors.newPassword").exists());
  }

  @Test
  void updateCurrentUserPasswordReturnsUnauthorizedWhenCurrentPasswordIsWrong() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    Mockito.doThrow(new BusinessException(ErrorCode.INVALID_CREDENTIALS))
        .when(userPasswordService)
        .changePassword(actor, "wrong-password123", "new-password123");

    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": "wrong-password123",
                  "newPassword": "new-password123"
                }
                """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
  }

  @Test
  void updateCurrentUserPasswordReturnsForbiddenForGuest() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-hash");
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    Mockito.doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(userPasswordService)
        .changePassword(actor, "password123", "new-password123");

    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": "password123",
                  "newPassword": "new-password123"
                }
                """))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void updateCurrentUserPasswordReturnsBadRequestWhenNewPasswordMatchesCurrentPassword() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    Mockito.doThrow(new BusinessException(ErrorCode.INVALID_PARAMETER))
        .when(userPasswordService)
        .changePassword(actor, "password123", "password123");

    mockMvc.perform(patch("/api/v1/users/me/password")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "currentPassword": "password123",
                  "newPassword": "password123"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void withdrawCurrentUserReturnsSuccess() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);

    mockMvc.perform(delete("/api/v1/users"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("User withdrawal succeeded"));

    then(userWithdrawalService).should().withdrawCurrentUser(actor);
  }

  @Test
  void withdrawCurrentUserReturnsForbiddenForGuest() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-hash");
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    Mockito.doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(userWithdrawalService)
        .withdrawCurrentUser(actor);

    mockMvc.perform(delete("/api/v1/users"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
}
