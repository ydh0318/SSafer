package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.LoginRequest;
import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.api.dto.OAuthLoginRequest;
import com.ssafer.auth.api.dto.OAuthLoginResponseData;
import com.ssafer.auth.api.dto.RefreshTokenRequest;
import com.ssafer.auth.application.service.AuthLoginService;
import com.ssafer.auth.application.service.AuthLogoutService;
import com.ssafer.auth.application.service.AuthOAuthLoginService;
import com.ssafer.auth.application.service.AuthTokenRefreshService;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.auth.application.service.OAuthLoginResult;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Email and OAuth authentication APIs")
public class AuthController {

  private static final String LOGIN_SUCCESS_MESSAGE = "Login succeeded";
  private static final String OAUTH_LOGIN_SUCCESS_MESSAGE = "OAuth login succeeded";
  private static final String REFRESH_SUCCESS_MESSAGE = "Token refresh succeeded";
  private static final String LOGOUT_SUCCESS_MESSAGE = "Logout succeeded";

  private final AuthLoginService authLoginService;
  private final AuthOAuthLoginService authOAuthLoginService;
  private final AuthTokenRefreshService authTokenRefreshService;
  private final AuthLogoutService authLogoutService;

  public AuthController(
      AuthLoginService authLoginService,
      AuthOAuthLoginService authOAuthLoginService,
      AuthTokenRefreshService authTokenRefreshService,
      AuthLogoutService authLogoutService
  ) {
    this.authLoginService = authLoginService;
    this.authOAuthLoginService = authOAuthLoginService;
    this.authTokenRefreshService = authTokenRefreshService;
    this.authLogoutService = authLogoutService;
  }

  @PostMapping("/login")
  @Operation(summary = "Email login", description = "Validate email and password, then issue access and refresh tokens.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "Login succeeded",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid request payload"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Invalid email or password")
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> login(@Valid @RequestBody LoginRequest request) {
    AuthTokenResult tokenResult = authLoginService.login(request.email(), request.password());

    return ResponseEntity.ok(ApiResponse.success(
        LOGIN_SUCCESS_MESSAGE,
        new LoginResponseData(
            tokenResult.accessToken(),
            tokenResult.accessTokenExpiresAt(),
            tokenResult.refreshToken(),
            tokenResult.refreshTokenExpiresAt()
        )
    ));
  }

  @PostMapping("/oauth/login")
  @Operation(
      summary = "OAuth 로그인",
      description = """
          OAuth 인가 코드를 제공자 사용자 정보로 교환한 뒤, 기존 계정을 매칭하거나 신규 계정을 생성해 로그인합니다.
          탈퇴한 계정에 연결된 소셜 계정이면 먼저 REJOIN_REQUIRED와 rejoinToken을 반환합니다.
          이후 confirmRejoin=true와 rejoinToken으로 같은 API를 다시 호출하면 해당 계정을 재활성화합니다.
          """
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "OAuth 로그인 성공",
          content = @Content(schema = @Schema(implementation = OAuthLoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 본문이 올바르지 않습니다."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "OAuth 인증에 실패했거나 제공자에서 검증 가능한 사용자 식별 정보를 주지 않았습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "탈퇴한 계정이므로 재가입 확인이 필요합니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "502",
          description = "OAuth 제공자 장애 또는 외부 서버 오류가 발생했습니다."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "500",
          description = "예상하지 못한 서버 내부 오류가 발생했습니다."
      )
  })
  public ResponseEntity<ApiResponse<OAuthLoginResponseData>> oauthLogin(@Valid @RequestBody OAuthLoginRequest request) {
    boolean confirmRejoin = Boolean.TRUE.equals(request.confirmRejoin());
    validateOAuthLoginRequest(request, confirmRejoin);

    OAuthLoginResult result = authOAuthLoginService.login(
        request.provider(),
        request.authorizationCode(),
        request.redirectUri(),
        confirmRejoin,
        request.rejoinToken()
    );

    return ResponseEntity.ok(ApiResponse.success(
        OAUTH_LOGIN_SUCCESS_MESSAGE,
        new OAuthLoginResponseData(
            result.provider(),
            result.providerUserId(),
            result.email(),
            result.displayName(),
            result.newUserCreated(),
            result.userId(),
            result.accountStatus(),
            result.accessToken(),
            result.accessTokenExpiresAt(),
            result.refreshToken(),
            result.refreshTokenExpiresAt()
        )
    ));
  }

  @PostMapping("/refresh")
  @Operation(summary = "Refresh token", description = "Validate the refresh token, then issue a new token pair.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "Token refresh succeeded",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid request payload"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Refresh token is invalid")
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
    AuthTokenResult tokenResult = authTokenRefreshService.refresh(request.refreshToken());

    return ResponseEntity.ok(ApiResponse.success(
        REFRESH_SUCCESS_MESSAGE,
        new LoginResponseData(
            tokenResult.accessToken(),
            tokenResult.accessTokenExpiresAt(),
            tokenResult.refreshToken(),
            tokenResult.refreshTokenExpiresAt()
        )
    ));
  }

  @PostMapping("/logout")
  @Operation(summary = "Logout", description = "Invalidate the current refresh token.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Logout succeeded"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid request payload"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Refresh token is invalid")
  })
  public ResponseEntity<ApiResponse<Void>> logout(@Valid @RequestBody RefreshTokenRequest request) {
    authLogoutService.logout(request.refreshToken());
    return ResponseEntity.ok(ApiResponse.success(LOGOUT_SUCCESS_MESSAGE, null));
  }

  private void validateOAuthLoginRequest(OAuthLoginRequest request, boolean confirmRejoin) {
    if (confirmRejoin) {
      // 재가입 확인 단계에서는 OAuth 인가 코드를 재사용하지 않고 짧은 수명의 rejoinToken만 사용한다.
      if (request.rejoinToken() == null || request.rejoinToken().isBlank()) {
        throw new BusinessException(ErrorCode.INVALID_PARAMETER);
      }
      return;
    }

    // 최초 OAuth 로그인 시도에는 새 authorization code와 redirect URI가 반드시 포함돼야 한다.
    if (request.authorizationCode() == null
        || request.authorizationCode().isBlank()
        || request.redirectUri() == null
        || request.redirectUri().isBlank()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
  }
}
