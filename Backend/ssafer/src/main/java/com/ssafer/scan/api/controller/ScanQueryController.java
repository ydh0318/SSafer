package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스캔 결과 조회", description = "스캔 결과 메타데이터와 상세 결과 조회 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
public class ScanQueryController {

  private static final String GET_SCAN_BASIC_SUCCESS_MESSAGE = "스캔 기본 조회 성공";

  private final ScanBasicQueryService scanBasicQueryService;

  @GetMapping("/{scanId}")
  @Operation(
      summary = "스캔 기본 조회",
      description = "스캔의 기본 메타데이터와 현재 진행 상태를 조회한다.")
  public ResponseEntity<ApiResponse<ScanBasicResponse>> getScanBasic(@PathVariable Long scanId) {
    // 조회와 인가 검사는 서비스에서 처리하고 컨트롤러는 응답 포맷만 맞춘다.
    ScanBasicResponse data = scanBasicQueryService.getScanBasic(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_BASIC_SUCCESS_MESSAGE, data));
  }
}
