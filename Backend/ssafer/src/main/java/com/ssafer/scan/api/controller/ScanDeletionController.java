package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.DeleteScanResponseData;
import com.ssafer.scan.application.service.ScanDeletionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스캔 삭제", description = "스캔 이력 삭제 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
public class ScanDeletionController {

  private static final String DELETE_SCAN_SUCCESS_MESSAGE = "스캔 이력 삭제 성공";

  private final ScanDeletionService scanDeletionService;

  @DeleteMapping("/{scanId}")
  @Operation(summary = "스캔 이력 삭제", description = "특정 스캔 이력을 soft delete 처리합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "스캔 이력 삭제 성공")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "400",
      description = "유효하지 않은 요청 파라미터 (INVALID_PARAMETER)"
  )
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "401",
      description = "인증 필요 또는 토큰 무효 (UNAUTHORIZED)"
  )
  @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "스캔 접근 권한 없음 (FORBIDDEN)")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "404",
      description = "스캔 없음 또는 이미 삭제됨 (NOT_FOUND)"
  )
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "409",
      description = "현재 상태에서는 삭제 불가 (SCAN_STATUS_CONFLICT)"
  )
  public ResponseEntity<ApiResponse<DeleteScanResponseData>> deleteScan(@PathVariable Long scanId) {
    DeleteScanResponseData data = scanDeletionService.deleteScan(scanId);
    return ResponseEntity.ok(ApiResponse.success(DELETE_SCAN_SUCCESS_MESSAGE, data));
  }
}
