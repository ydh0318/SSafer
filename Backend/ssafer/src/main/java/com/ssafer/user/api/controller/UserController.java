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
import com.ssafer.user.api.dto.CheckNicknameRequest;
import com.ssafer.user.api.dto.CheckNicknameResponseData;
import com.ssafer.user.api.dto.RegisterUserRequest;
import com.ssafer.user.api.dto.RegisterUserResponseData;
import com.ssafer.user.api.dto.SocialAccountConnectRequest;
import com.ssafer.user.api.dto.SocialAccountResponseData;
import com.ssafer.user.api.dto.SocialAccountsResponseData;
import com.ssafer.user.api.dto.UpdatePasswordRequest;
import com.ssafer.user.api.dto.UpdateUserProfileRequest;
import com.ssafer.user.api.dto.UserProfileResponseData;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.application.service.UserProfileResult;
import com.ssafer.user.application.service.UserProfileService;
import com.ssafer.user.application.service.UserRegistrationService;
import com.ssafer.user.application.service.UserSocialAccountResult;
import com.ssafer.user.application.service.UserSocialAccountService;
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
@Tag(name = "회원", description = "회원 계정 및 프로필 관련 API")
public class UserController {

  private static final String REGISTER_SUCCESS_MESSAGE = "User registration succeeded";
  private static final String CHECK_EMAIL_SUCCESS_MESSAGE = "Email availability check succeeded";
  private static final String CHECK_NICKNAME_SUCCESS_MESSAGE = "Nickname availability check succeeded";
  private static final String PROFILE_RETRIEVE_SUCCESS_MESSAGE = "User profile retrieval succeeded";
  private static final String PROFILE_UPDATE_SUCCESS_MESSAGE = "User profile update succeeded";
  private static final String PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password change succeeded";
  private static final String WITHDRAWAL_SUCCESS_MESSAGE = "User withdrawal succeeded";
  private static final String SOCIAL_ACCOUNTS_RETRIEVE_SUCCESS_MESSAGE = "Connected social accounts retrieval succeeded";
  private static final String SOCIAL_ACCOUNT_CONNECT_SUCCESS_MESSAGE = "Social account connection succeeded";
  private static final String SOCIAL_ACCOUNT_DISCONNECT_SUCCESS_MESSAGE = "Social account disconnection succeeded";

  private final CurrentActorProvider currentActorProvider;
  private final UserRegistrationService userRegistrationService;
  private final UserProfileService userProfileService;
  private final UserPasswordService userPasswordService;
  private final UserSocialAccountService userSocialAccountService;
  private final UserWithdrawalService userWithdrawalService;

  public UserController(
      CurrentActorProvider currentActorProvider,
      UserRegistrationService userRegistrationService,
      UserProfileService userProfileService,
      UserPasswordService userPasswordService,
      UserSocialAccountService userSocialAccountService,
      UserWithdrawalService userWithdrawalService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.userRegistrationService = userRegistrationService;
    this.userProfileService = userProfileService;
    this.userPasswordService = userPasswordService;
    this.userSocialAccountService = userSocialAccountService;
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
          description = "요청 본문이 올바르지 않거나 필수 값이 누락되었습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "이미 가입된 이메일이거나 사용 중인 닉네임입니다."
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
          description = "이메일 형식이 올바르지 않거나 쿼리 파라미터가 누락되었습니다."
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

  @GetMapping("/check-nickname")
  @Operation(
      summary = "닉네임 중복 확인",
      description = "회원가입 또는 프로필 수정에 사용할 수 있는 닉네임인지 확인합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "닉네임 중복 확인 성공",
          content = @Content(schema = @Schema(implementation = CheckNicknameResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "닉네임 형식이 올바르지 않거나 쿼리 파라미터가 누락되었습니다."
      )
  })
  public ResponseEntity<ApiResponse<CheckNicknameResponseData>> checkNickname(
      @Valid @ModelAttribute CheckNicknameRequest request
  ) {
    boolean available = userRegistrationService.isDisplayNameAvailable(request.getNickname());
    return ResponseEntity.ok(
        ApiResponse.success(CHECK_NICKNAME_SUCCESS_MESSAGE, new CheckNicknameResponseData(available))
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
          description = "인증이 필요하거나 토큰이 올바르지 않습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "회원 정보를 찾을 수 없습니다."
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

  @GetMapping("/me/socials")
  public ResponseEntity<ApiResponse<SocialAccountsResponseData>> getCurrentUserSocialAccounts() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    SocialAccountsResponseData responseData = new SocialAccountsResponseData(
        userSocialAccountService.getCurrentUserSocialAccounts(actor).stream()
            .map(this::toResponseData)
            .toList()
    );
    return ResponseEntity.ok(ApiResponse.success(
        SOCIAL_ACCOUNTS_RETRIEVE_SUCCESS_MESSAGE,
        responseData
    ));
  }

  @PostMapping("/me/socials/google")
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGoogleSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GOOGLE, request);
  }

  @DeleteMapping("/me/socials/google")
  public ResponseEntity<ApiResponse<Void>> disconnectGoogleSocialAccount() {
    return disconnectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GOOGLE);
  }

  @PostMapping("/me/socials/github")
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGithubSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GITHUB, request);
  }

  @DeleteMapping("/me/socials/github")
  public ResponseEntity<ApiResponse<Void>> disconnectGithubSocialAccount() {
    return disconnectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GITHUB);
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
          description = "요청 본문이 올바르지 않거나 필수 값이 누락되었습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 올바르지 않습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "회원 정보를 찾을 수 없습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "이미 사용 중인 닉네임입니다."
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> updateCurrentUserProfile(
      @Valid @RequestBody(required = false) UpdateUserProfileRequest request
  ) {
    // 요청 본문 자체가 없거나 displayName 필드가 빠지면 잘못된 요청으로 본다.
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
          description = "요청 본문이 올바르지 않거나 필수 값이 누락되었습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 올바르지 않습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "회원 정보를 찾을 수 없습니다."
      )
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> updateCurrentUserPassword(
      @Valid @RequestBody(required = false) UpdatePasswordRequest request
  ) {
    // 비밀번호 변경은 현재 비밀번호와 새 비밀번호가 모두 있어야 처리할 수 있다.
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
      description = "현재 로그인한 회원 계정을 비활성화하고 refresh token을 제거합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "회원 탈퇴 성공"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 올바르지 않습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 전용 API에 접근할 수 없습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "회원 정보를 찾을 수 없습니다."
      )
  })
  public ResponseEntity<ApiResponse<Void>> withdrawCurrentUser() {
    // 탈퇴 후 계정은 비활성화되고 refresh token 도 함께 정리된다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userWithdrawalService.withdrawCurrentUser(actor);
    return ResponseEntity.ok(ApiResponse.success(WITHDRAWAL_SUCCESS_MESSAGE, null));
  }

  private ResponseEntity<ApiResponse<SocialAccountResponseData>> connectSocialAccount(
      com.ssafer.auth.domain.enums.OAuthProvider provider,
      SocialAccountConnectRequest request
  ) {
    if (request == null || request.authorizationCode() == null || request.redirectUri() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserSocialAccountResult result = userSocialAccountService.connectCurrentUserSocialAccount(
        actor,
        provider,
        request.authorizationCode(),
        request.redirectUri()
    );
    return ResponseEntity.ok(ApiResponse.success(
        SOCIAL_ACCOUNT_CONNECT_SUCCESS_MESSAGE,
        toResponseData(result)
    ));
  }

  private ResponseEntity<ApiResponse<Void>> disconnectSocialAccount(
      com.ssafer.auth.domain.enums.OAuthProvider provider
  ) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userSocialAccountService.disconnectCurrentUserSocialAccount(actor, provider);
    return ResponseEntity.ok(ApiResponse.success(SOCIAL_ACCOUNT_DISCONNECT_SUCCESS_MESSAGE, null));
  }

  private SocialAccountResponseData toResponseData(UserSocialAccountResult result) {
    return new SocialAccountResponseData(
        result.provider(),
        result.connected(),
        result.email(),
        result.connectedAt()
    );
  }
}
