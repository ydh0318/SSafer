package com.ssafer.user.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.user.api.dto.CheckEmailResponseData;
import com.ssafer.user.api.dto.CheckEmailRequest;
import com.ssafer.user.api.dto.RegisterUserRequest;
import com.ssafer.user.api.dto.RegisterUserResponseData;
import com.ssafer.user.api.dto.UpdateUserProfileRequest;
import com.ssafer.user.api.dto.UserProfileResponseData;
import com.ssafer.user.application.service.UserProfileResult;
import com.ssafer.user.application.service.UserProfileService;
import com.ssafer.user.application.service.UserRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "회원", description = "회원가입 및 이메일 중복 확인 API")
public class UserController {

  private static final String REGISTER_SUCCESS_MESSAGE = "User registration succeeded";
  private static final String CHECK_EMAIL_SUCCESS_MESSAGE = "Email availability check succeeded";
  private static final String PROFILE_RETRIEVE_SUCCESS_MESSAGE = "User profile retrieval succeeded";
  private static final String PROFILE_UPDATE_SUCCESS_MESSAGE = "User profile update succeeded";

  private final CurrentActorProvider currentActorProvider;
  private final UserRegistrationService userRegistrationService;
  private final UserProfileService userProfileService;

  public UserController(
      CurrentActorProvider currentActorProvider,
      UserRegistrationService userRegistrationService,
      UserProfileService userProfileService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.userRegistrationService = userRegistrationService;
    this.userProfileService = userProfileService;
  }

  @PostMapping
  @Operation(
      summary = "회원가입",
      description = "이메일, 사용자명, 비밀번호를 받아 자체 회원가입을 처리합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "201",
          description = "회원가입 성공",
          content = @Content(schema = @Schema(implementation = RegisterUserResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청값 형식 오류 또는 필수값 누락"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "이미 가입된 이메일"
      )
  })
  public ResponseEntity<ApiResponse<RegisterUserResponseData>> register(
      @Valid @RequestBody RegisterUserRequest request
  ) {
    // 실제 정규화, 중복 확인, 비밀번호 해시는 서비스 계층에서 수행한다.
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
      description = "회원가입 전에 사용 가능한 이메일인지 확인합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "이메일 중복 확인 성공",
          content = @Content(schema = @Schema(implementation = CheckEmailResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "이메일 형식 오류 또는 쿼리 파라미터 누락"
      )
  })
  public ResponseEntity<ApiResponse<CheckEmailResponseData>> checkEmail(
      @Valid @ModelAttribute CheckEmailRequest request
  ) {
    // 이메일 중복 확인은 회원가입과 같은 정규화 규칙을 재사용한다.
    boolean available = userRegistrationService.isEmailAvailable(request.getEmail());
    return ResponseEntity.ok(
        ApiResponse.success(CHECK_EMAIL_SUCCESS_MESSAGE, new CheckEmailResponseData(available))
    );
  }

  @GetMapping("/me")
  @Operation(
      summary = "사용자 설정 조회",
      description = "현재 로그인한 회원의 사용자 설정 정보를 조회합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "사용자 설정 조회 성공",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "회원 전용 기능에 게스트가 접근함"
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
      summary = "사용자 설정 수정",
      description = "현재 로그인한 회원의 displayName을 수정합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "사용자 설정 수정 성공",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청 본문이 비어 있거나 형식이 올바르지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "회원 전용 기능에 게스트가 접근함"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "사용자 정보를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> updateCurrentUserProfile(
      @Valid @RequestBody(required = false) UpdateUserProfileRequest request
  ) {
    // 본문 자체가 없으면 수정할 값이 없으므로 잘못된 요청으로 처리한다.
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
}
