package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.SendPasswordResetCodeRequest;
import com.ssafer.auth.application.service.PasswordResetCodeService;
import com.ssafer.global.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/password-reset")
@Tag(name = "비밀번호 찾기", description = "비밀번호 찾기 인증코드 요청 API")
public class PasswordResetController {

  private static final String SEND_CODE_SUCCESS_MESSAGE = "Password reset verification code sent";

  private final PasswordResetCodeService passwordResetCodeService;

  public PasswordResetController(PasswordResetCodeService passwordResetCodeService) {
    this.passwordResetCodeService = passwordResetCodeService;
  }

  @PostMapping("/send-code")
  @Operation(
      summary = "비밀번호 찾기 인증코드 전송",
      description = "가입된 계정의 이메일로 비밀번호 재설정용 인증코드를 전송합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "인증코드 전송 요청 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 형식 오류"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "인증코드 재요청 제한")
  })
  public ResponseEntity<ApiResponse<Void>> sendCode(
      @Valid @RequestBody SendPasswordResetCodeRequest request
  ) {
    // 공개 엔드포인트이므로 성공 응답은 항상 단순하게 유지한다.
    passwordResetCodeService.sendResetCode(request.email());
    return ResponseEntity.ok(ApiResponse.success(SEND_CODE_SUCCESS_MESSAGE, null));
  }
}
