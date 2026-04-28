package com.ssafer.auth.api.controller;

import com.ssafer.auth.api.dto.SendEmailVerificationCodeRequest;
import com.ssafer.auth.api.dto.VerifyEmailVerificationCodeRequest;
import com.ssafer.auth.application.service.EmailVerificationService;
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
@RequestMapping("/api/v1/auth/email")
@Tag(name = "이메일 인증", description = "이메일 인증 코드 전송 및 확인 API")
public class EmailVerificationController {

  private static final String SEND_CODE_SUCCESS_MESSAGE = "이메일 인증 코드 전송 성공";
  private static final String VERIFY_CODE_SUCCESS_MESSAGE = "이메일 인증 성공";

  private final EmailVerificationService emailVerificationService;

  public EmailVerificationController(EmailVerificationService emailVerificationService) {
    this.emailVerificationService = emailVerificationService;
  }

  @PostMapping("/send-code")
  @Operation(summary = "이메일 인증 코드 전송", description = "회원가입 전에 이메일 인증 코드를 발송합니다.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "인증 코드 전송 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청값 형식 오류 또는 이미 가입된 이메일"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "인증 코드 재요청 제한"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502", description = "메일 발송 실패")
  })
  public ResponseEntity<ApiResponse<Void>> sendCode(
      @Valid @RequestBody SendEmailVerificationCodeRequest request
  ) {
    // 전송 API는 코드 생성, 저장, 재요청 제한, 메일 발송까지 한 번에 처리한다.
    emailVerificationService.sendVerificationCode(request.email());
    return ResponseEntity.ok(ApiResponse.success(SEND_CODE_SUCCESS_MESSAGE, null));
  }

  @PostMapping("/verify-code")
  @Operation(summary = "이메일 인증 코드 확인", description = "발송된 인증 코드를 확인하고 인증 완료 상태를 저장합니다.")
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "이메일 인증 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청값 형식 오류 또는 잘못된 인증 코드")
  })
  public ResponseEntity<ApiResponse<Void>> verifyCode(
      @Valid @RequestBody VerifyEmailVerificationCodeRequest request
  ) {
    // 인증이 끝나면 이후 회원가입에서 사용할 수 있도록 verified 상태를 저장한다.
    emailVerificationService.verifyCode(request.email(), request.code());
    return ResponseEntity.ok(ApiResponse.success(VERIFY_CODE_SUCCESS_MESSAGE, null));
  }
}
