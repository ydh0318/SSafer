package com.ssafer.user.api.controller;

import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.user.api.dto.CheckEmailRequest;
import com.ssafer.user.api.dto.CheckEmailResponseData;
import com.ssafer.user.api.dto.RegisterUserRequest;
import com.ssafer.user.api.dto.RegisterUserResponseData;
import com.ssafer.user.api.dto.UpdatePasswordRequest;
import com.ssafer.user.api.dto.UpdateUserProfileRequest;
import com.ssafer.user.api.dto.UserProfileResponseData;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.application.service.UserProfileResult;
import com.ssafer.user.application.service.UserProfileService;
import com.ssafer.user.application.service.UserRegistrationService;
import com.ssafer.user.application.service.UserWithdrawalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "회원", description = "회원 계정과 프로필 관련 API")
public class UserController {

  private static final String REGISTER_SUCCESS_MESSAGE = "User registration succeeded";
  private static final String CHECK_EMAIL_SUCCESS_MESSAGE = "Email availability check succeeded";
  private static final String PROFILE_RETRIEVE_SUCCESS_MESSAGE = "User profile retrieval succeeded";
  private static final String PROFILE_UPDATE_SUCCESS_MESSAGE = "User profile update succeeded";
  private static final String PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password change succeeded";
  private static final String WITHDRAWAL_SUCCESS_MESSAGE = "User withdrawal succeeded";

  private final CurrentActorProvider currentActorProvider;
  private final UserRegistrationService userRegistrationService;
  private final UserProfileService userProfileService;
  private final UserPasswordService userPasswordService;
  private final UserWithdrawalService userWithdrawalService;

  public UserController(
      CurrentActorProvider currentActorProvider,
      UserRegistrationService userRegistrationService,
      UserProfileService userProfileService,
      UserPasswordService userPasswordService,
      UserWithdrawalService userWithdrawalService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.userRegistrationService = userRegistrationService;
    this.userProfileService = userProfileService;
    this.userPasswordService = userPasswordService;
    this.userWithdrawalService = userWithdrawalService;
  }

  @PostMapping
  @Operation(
      summary = "회원가입",
      description = "이메일, 닉네임, 비밀번호로 회원 계정을 생성합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "201",
          description = "회원가입 성공",
          content = @Content(schema = @Schema(implementation = RegisterUserResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청 본문이 잘못되었거나 필수 값이 누락됨"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "이미 가입된 이메일임"
      )
  })
  public ResponseEntity<ApiResponse<RegisterUserResponseData>> register(
      @Valid @RequestBody RegisterUserRequest request
  ) {
    Long userId = userRegistrationService.register(
        request.email(),
        request.displayName(),
        request.password()
    );

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success(REGISTER_SUCCESS_MESSAGE, new RegisterUserResponseData(userId)));
  }

  @GetMapping("/check-email")
  @Operation(
      summary = "이메일 중복 확인",
      description = "회원가입에 사용할 수 있는 이메일인지 확인합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "이메일 중복 확인 성공",
          content = @Content(schema = @Schema(implementation = CheckEmailResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "이메일 형식이 잘못되었거나 쿼리 파라미터가 누락됨"
      )
  })
  public ResponseEntity<ApiResponse<CheckEmailResponseData>> checkEmail(
      @Valid @ModelAttribute CheckEmailRequest request
  ) {
    boolean available = userRegistrationService.isEmailAvailable(request.getEmail());
    return ResponseEntity.ok(
        ApiResponse.success(CHECK_EMAIL_SUCCESS_MESSAGE, new CheckEmailResponseData(available))
    );
  }

  @GetMapping("/me")
  @Operation(
      summary = "내 프로필 조회",
      description = "현재 로그인한 회원의 프로필 정보를 조회합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "프로필 조회 성공",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "사용자 정보를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> getCurrentUserProfile() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserProfileResult profile = userProfileService.getCurrentUserProfile(actor);
    return ResponseEntity.ok(ApiResponse.success(
        PROFILE_RETRIEVE_SUCCESS_MESSAGE,
        new UserProfileResponseData(profile.email(), profile.displayName())
    ));
  }

  @PatchMapping("/me/profile")
  @Operation(
      summary = "내 프로필 수정",
      description = "현재 로그인한 회원의 닉네임을 수정합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "프로필 수정 성공",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청 본문이 잘못되었거나 필수 값이 누락됨"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "사용자 정보를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> updateCurrentUserProfile(
      @Valid @RequestBody(required = false) UpdateUserProfileRequest request
  ) {
    // 수정할 닉네임 값이 없으면 잘못된 요청으로 처리한다.
    if (request == null || request.displayName() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserProfileResult profile = userProfileService.updateCurrentUserProfile(actor, request.displayName());
    return ResponseEntity.ok(ApiResponse.success(
        PROFILE_UPDATE_SUCCESS_MESSAGE,
        new UserProfileResponseData(profile.email(), profile.displayName())
    ));
  }

  @PatchMapping("/me/password")
  @Operation(
      summary = "비밀번호 변경",
      description = "현재 로그인한 회원의 비밀번호를 변경합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "비밀번호 변경 성공",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청 본문이 잘못되었거나 필수 값이 누락됨"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "사용자 정보를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> updateCurrentUserPassword(
      @Valid @RequestBody(required = false) UpdatePasswordRequest request
  ) {
    // 현재 비밀번호와 새 비밀번호가 모두 있어야 변경을 진행할 수 있다.
    if (request == null || request.currentPassword() == null || request.newPassword() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    AuthTokenResult tokenResult = userPasswordService.changePassword(
        actor,
        request.currentPassword(),
        request.newPassword()
    );
    return ResponseEntity.ok(ApiResponse.success(
        PASSWORD_CHANGE_SUCCESS_MESSAGE,
        new LoginResponseData(
            tokenResult.accessToken(),
            tokenResult.accessTokenExpiresAt(),
            tokenResult.refreshToken(),
            tokenResult.refreshTokenExpiresAt()
        )
    ));
  }

  @DeleteMapping
  @Operation(
      summary = "회원 탈퇴",
      description = "현재 로그인한 회원 계정을 비활성화하고 refresh token을 삭제합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "회원 탈퇴 성공"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "사용자 정보를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<Void>> withdrawCurrentUser() {
    // 탈퇴는 회원 전용 기능이며, 성공하면 계정은 비활성화 상태가 된다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userWithdrawalService.withdrawCurrentUser(actor);
    return ResponseEntity.ok(ApiResponse.success(WITHDRAWAL_SUCCESS_MESSAGE, null));
  }
}
