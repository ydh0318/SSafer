package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.CompletePasswordResetRequest;
import com.ssafer.auth.api.dto.SendPasswordResetCodeRequest;
import com.ssafer.auth.api.dto.VerifyPasswordResetCodeRequest;
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
@Tag(name = "비밀번호 찾기", description = "비밀번호 찾기 및 재설정 API")
public class PasswordResetController {

  private static final String SEND_CODE_SUCCESS_MESSAGE = "Password reset verification code sent";
  private static final String VERIFY_CODE_SUCCESS_MESSAGE = "Password reset verification succeeded";
  private static final String COMPLETE_RESET_SUCCESS_MESSAGE = "Password reset completed";

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
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "인증코드 요청 제한")
  })
  public ResponseEntity<ApiResponse<Void>> sendCode(
      @Valid @RequestBody SendPasswordResetCodeRequest request
  ) {
    // 공개 엔드포인트이므로 성공 응답은 단순하게 유지한다.
    passwordResetCodeService.sendResetCode(request.email());
    return ResponseEntity.ok(ApiResponse.success(SEND_CODE_SUCCESS_MESSAGE, null));
  }

  @PostMapping("/verify-code")
  @Operation(
      summary = "비밀번호 재설정 코드 검증",
      description = "이메일로 전송된 비밀번호 재설정 코드를 확인합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "비밀번호 재설정 코드 검증 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 형식 오류 또는 코드 불일치")
  })
  public ResponseEntity<ApiResponse<Void>> verifyCode(
      @Valid @RequestBody VerifyPasswordResetCodeRequest request
  ) {
    // 코드 검증이 끝나면 재설정 완료 API에서 사용할 verified 상태를 저장한다.
    passwordResetCodeService.verifyCode(request.email(), request.code());
    return ResponseEntity.ok(ApiResponse.success(VERIFY_CODE_SUCCESS_MESSAGE, null));
  }

  @PostMapping("/complete")
  @Operation(
      summary = "비밀번호 재설정 완료",
      description = "코드 검증이 끝난 계정에 한해 새 비밀번호로 재설정합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "비밀번호 재설정 완료"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 형식 오류 또는 검증 미완료")
  })
  public ResponseEntity<ApiResponse<Void>> completeReset(
      @Valid @RequestBody CompletePasswordResetRequest request
  ) {
    // 재설정이 끝나면 기존 refresh token도 함께 정리한다.
    passwordResetCodeService.completeReset(request.email(), request.newPassword());
    return ResponseEntity.ok(ApiResponse.success(COMPLETE_RESET_SUCCESS_MESSAGE, null));
  }
}
