package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.application.service.CliRawResultUploadReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "CLI Raw 결과 업로드 완료 보고", description = "CLI raw results 업로드 완료 보고 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
// CLI가 S3 업로드를 끝낸 뒤 호출하는 사용자용 완료 보고 API 컨트롤러.
public class CliRawResultUploadReportController {

  private static final String SUCCESS_MESSAGE = "Raw 결과 업로드 완료 보고 성공";

  private final CurrentActorProvider currentActorProvider;
  private final CliRawResultUploadReportService cliRawResultUploadReportService;

  @PostMapping("/{scanId}/raw-results")
  @Operation(summary = "CLI Raw 결과 업로드 완료 보고")
  public ResponseEntity<ApiResponse<CliRawResultUploadReportResponseData>> reportRawUploadCompleted(
      @PathVariable Long scanId,
      @Valid @RequestBody CliRawResultUploadReportRequest request
  ) {
    // Bearer 인증 주체를 서비스에 전달해 scan 접근 권한을 함께 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    CliRawResultUploadReportResponseData data = cliRawResultUploadReportService.report(scanId, actor, request);
    return ResponseEntity.ok(ApiResponse.success(SUCCESS_MESSAGE, data));
  }
}
