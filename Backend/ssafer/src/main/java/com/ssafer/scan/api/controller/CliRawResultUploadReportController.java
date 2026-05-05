package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.application.service.CliRawResultUploadReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "CLI raw 결과 업로드 완료 보고", description = "CLI가 raw 결과 업로드 완료를 알리는 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
// 이 API는 CLI 전용 완료 알림이다.
// 워커 분석 완료 콜백은 internal 경로의 별도 API에서 처리할 예정이다.
public class CliRawResultUploadReportController {

  private static final String SUCCESS_MESSAGE = "CLI 분석 완료 알림 성공";

  private final CurrentActorProvider currentActorProvider;
  private final CliRawResultUploadReportService cliRawResultUploadReportService;

  @PostMapping("/{scanId}/raw-results")
  @Operation(summary = "CLI 분석 완료 알림")
  @ApiResponses(value = {
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "CLI 분석 완료 알림 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 값 오류 (INVALID_PARAMETER, INVALID_PAYLOAD_HASH)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증 실패 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "scan 접근 권한 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "scan 또는 raw result 객체 없음 (NOT_FOUND, RAW_RESULT_NOT_FOUND)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "상태 충돌 또는 중복 보고 (SCAN_STATUS_CONFLICT, DUPLICATE_RAW_RESULT_UPLOAD)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<CliRawResultUploadReportResponseData>> reportRawUploadCompleted(
      @PathVariable Long scanId,
      @Valid @RequestBody CliRawResultUploadReportRequest request
  ) {
    // 인증 주체를 서비스에 전달하고 scan 접근 권한까지 함께 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    CliRawResultUploadReportResponseData data = cliRawResultUploadReportService.report(scanId, actor, request);
    return ResponseEntity.ok(ApiResponse.success(SUCCESS_MESSAGE, data));
  }
}
