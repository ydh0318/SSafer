package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.LoginRequest;
import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.application.service.AuthLoginService;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.api.ApiResponse;
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
@Tag(name = "인증", description = "이메일 인증 및 로그인 API")
public class AuthController {

  private static final String LOGIN_SUCCESS_MESSAGE = "Login succeeded";

  private final AuthLoginService authLoginService;

  public AuthController(AuthLoginService authLoginService) {
    this.authLoginService = authLoginService;
  }

  @PostMapping("/login")
  @Operation(summary = "자체 로그인", description = "이메일과 비밀번호를 검증한 뒤 access token과 refresh token을 발급합니다.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "로그인 성공",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "요청값 형식 오류 또는 필수값 누락"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "이메일 또는 비밀번호 불일치"
      )
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> login(
      @Valid @RequestBody LoginRequest request
  ) {
    // 로그인은 세션을 만들지 않고 access/refresh 토큰만 발급해서 응답한다.
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
}
