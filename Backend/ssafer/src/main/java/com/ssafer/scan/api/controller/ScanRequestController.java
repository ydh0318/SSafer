package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.CreateScanRequest;
import com.ssafer.scan.api.dto.CreateScanResponseData;
import com.ssafer.scan.application.service.ScanRegistrationResult;
import com.ssafer.scan.application.service.ScanRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스캔 요청", description = "Agent/CLI 스캔 요청 등록 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
// 스캔 시작 요청을 받는 API 컨트롤러.
// 컨트롤러는 인증 주체 조회와 입출력 매핑만 담당하고, 비즈니스 로직은 서비스에 위임한다.
public class ScanRequestController {

  private static final String CREATE_SCAN_SUCCESS_MESSAGE = "스캔 요청 등록 성공";

  private final CurrentActorProvider currentActorProvider;
  private final ScanRegistrationService scanRegistrationService;

  @PostMapping
  @Operation(
      summary = "스캔 요청 등록",
      description = "Agent/CLI가 로컬 스캔 시작 전 scan을 등록하고 업로드 정보를 발급받는다.")
  public ResponseEntity<ApiResponse<CreateScanResponseData>> createScan(
      @Valid @RequestBody CreateScanRequest request
  ) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    ScanRegistrationResult result = scanRegistrationService.register(actor, request);

    CreateScanResponseData data = new CreateScanResponseData(
        result.scanId(),
        result.projectId(),
        result.status(),
        result.rawResultPath(),
        result.rawUploadUrl());

    // 스캔 등록으로 서버 리소스(scans row)가 생성되므로 201 Created를 반환한다.
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success(CREATE_SCAN_SUCCESS_MESSAGE, data));
  }
}
