package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.LoginRequest;
import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.application.service.AuthLoginService;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private static final String LOGIN_SUCCESS_MESSAGE = "Login succeeded";

  private final AuthLoginService authLoginService;

  public AuthController(AuthLoginService authLoginService) {
    this.authLoginService = authLoginService;
  }

  @PostMapping("/login")
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
