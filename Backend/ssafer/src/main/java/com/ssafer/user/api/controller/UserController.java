package com.ssafer.user.api.controller;

import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.domain.enums.OAuthProvider;
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
import com.ssafer.user.api.dto.SetupPasswordRequest;
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
  private static final String PASSWORD_SETUP_SUCCESS_MESSAGE = "Password setup succeeded";
  private static final String PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password change succeeded";
  private static final String WITHDRAWAL_SUCCESS_MESSAGE = "User withdrawal succeeded";
  private static final String SOCIAL_ACCOUNTS_RETRIEVE_SUCCESS_MESSAGE =
      "Connected social accounts retrieval succeeded";
  private static final String SOCIAL_ACCOUNT_CONNECT_SUCCESS_MESSAGE =
      "Social account connection succeeded";
  private static final String SOCIAL_ACCOUNT_DISCONNECT_SUCCESS_MESSAGE =
      "Social account disconnection succeeded";

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
          description = "이미 가입한 이메일이거나 사용 중인 닉네임입니다."
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
          description = "인증이 필요하거나 토큰이 유효하지 않습니다."
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
  @Operation(
      summary = "연결된 소셜 계정 조회",
      description = "현재 로그인한 회원의 Google, GitHub 연결 상태를 조회합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "연결된 소셜 계정 조회 성공",
          content = @Content(schema = @Schema(implementation = SocialAccountsResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요합니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "게스트 계정은 회원 소셜 계정을 관리할 수 없습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "현재 활성 회원 정보를 찾을 수 없습니다.")
  })
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
  @Operation(
      summary = "Google 계정 연결",
      description = "OAuth 인가 코드를 사용해 현재 로그인한 회원 계정에 Google 계정을 연결합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "Google 계정 연결 성공",
          content = @Content(schema = @Schema(implementation = SocialAccountResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "인가 코드 또는 redirect URI 요청값이 올바르지 않습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 Google 인증에 실패했습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "이미 연결된 Google 계정이거나 다른 회원에게 연결된 계정입니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502", description = "Google OAuth 제공자를 사용할 수 없습니다.")
  })
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGoogleSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(OAuthProvider.GOOGLE, request);
  }

  @DeleteMapping("/me/socials/google")
  @Operation(
      summary = "Google 계정 연결 해제",
      description = "현재 로그인한 회원 계정에서 Google 계정 연결을 해제합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Google 계정 연결 해제 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요합니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "연결된 Google 계정이 없습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "마지막 로그인 수단은 해제할 수 없습니다.")
  })
  public ResponseEntity<ApiResponse<Void>> disconnectGoogleSocialAccount() {
    return disconnectSocialAccount(OAuthProvider.GOOGLE);
  }

  @PostMapping("/me/socials/github")
  @Operation(
      summary = "GitHub 계정 연결",
      description = "OAuth 인가 코드를 사용해 현재 로그인한 회원 계정에 GitHub 계정을 연결합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "GitHub 계정 연결 성공",
          content = @Content(schema = @Schema(implementation = SocialAccountResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "인가 코드 또는 redirect URI 요청값이 올바르지 않습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 GitHub 인증에 실패했습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "이미 연결된 GitHub 계정이거나 다른 회원에게 연결된 계정입니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502", description = "GitHub OAuth 제공자를 사용할 수 없습니다.")
  })
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGithubSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(OAuthProvider.GITHUB, request);
  }

  @DeleteMapping("/me/socials/github")
  @Operation(
      summary = "GitHub 계정 연결 해제",
      description = "현재 로그인한 회원 계정에서 GitHub 계정 연결을 해제합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "GitHub 계정 연결 해제 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요합니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "연결된 GitHub 계정이 없습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "마지막 로그인 수단은 해제할 수 없습니다.")
  })
  public ResponseEntity<ApiResponse<Void>> disconnectGithubSocialAccount() {
    return disconnectSocialAccount(OAuthProvider.GITHUB);
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
          description = "인증이 필요하거나 토큰이 유효하지 않습니다."
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
    // 요청 본문 자체가 없거나 displayName 필드가 비면 잘못된 요청으로 본다.
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
          description = "인증이 필요하거나 토큰이 유효하지 않습니다."
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

  @PostMapping("/me/password/setup")
  @Operation(
      summary = "소셜 계정 비밀번호 최초 설정",
      description = "현재 로그인한 소셜 계정에 로컬 로그인용 비밀번호를 최초 설정합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "소셜 계정 비밀번호 최초 설정 성공",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청 본문이 올바르지 않거나 비밀번호 형식이 잘못되었습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "이미 비밀번호가 설정된 계정이거나 소셜 비밀번호 설정 대상이 아닙니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않습니다."
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
  public ResponseEntity<ApiResponse<LoginResponseData>> setupCurrentUserPassword(
      @Valid @RequestBody(required = false) SetupPasswordRequest request
  ) {
    // 최초 설정은 새 비밀번호만 받으며, 본문 자체가 없으면 잘못된 요청으로 처리한다.
    if (request == null || request.newPassword() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    AuthTokenResult tokenResult = userPasswordService.setupPassword(actor, request.newPassword());
    return ResponseEntity.ok(ApiResponse.success(
        PASSWORD_SETUP_SUCCESS_MESSAGE,
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
          description = "인증이 필요하거나 토큰이 유효하지 않습니다."
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
    // 탈퇴 시 계정은 비활성화되고 refresh token도 함께 정리한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userWithdrawalService.withdrawCurrentUser(actor);
    return ResponseEntity.ok(ApiResponse.success(WITHDRAWAL_SUCCESS_MESSAGE, null));
  }

  private ResponseEntity<ApiResponse<SocialAccountResponseData>> connectSocialAccount(
      OAuthProvider provider,
      SocialAccountConnectRequest request
  ) {
    // 소셜 계정 연결은 이미 로그인한 회원 세션에서만 수행한다.
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

  private ResponseEntity<ApiResponse<Void>> disconnectSocialAccount(OAuthProvider provider) {
    // 계정을 사용할 수 없는 상태로 만들지 않도록 마지막 로그인 수단 해제를 막는다.
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
