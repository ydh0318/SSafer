package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.dto.ScanFindingListResponseData;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.application.service.ScanFindingListQueryService;
import com.ssafer.scan.application.service.ScanSummaryQueryService;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스캔 결과 조회", description = "스캔 결과 메타데이터와 상세 결과를 조회하는 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
public class ScanQueryController {

  private static final String GET_SCAN_BASIC_SUCCESS_MESSAGE = "스캔 기본 조회 성공";
  private static final String GET_SCAN_SUMMARY_SUCCESS_MESSAGE = "스캔 결과 요약 조회 성공";
  private static final String GET_SCAN_FINDINGS_SUCCESS_MESSAGE = "스캔 취약점 목록 조회 성공";

  private final ScanBasicQueryService scanBasicQueryService;
  private final ScanSummaryQueryService scanSummaryQueryService;
  private final ScanFindingListQueryService scanFindingListQueryService;

  @GetMapping("/{scanId}")
  @Operation(
      summary = "스캔 기본 조회",
      description = "스캔의 기본 메타데이터와 현재 진행 상태를 조회한다.")
  public ResponseEntity<ApiResponse<ScanBasicResponse>> getScanBasic(@PathVariable Long scanId) {
    // 조회와 인가 검사는 서비스에서 처리하고 컨트롤러는 응답 형식만 맞춘다.
    ScanBasicResponse data = scanBasicQueryService.getScanBasic(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_BASIC_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}/summary")
  @Operation(
      summary = "스캔 결과 요약 조회",
      description = "스캔 결과의 전체 개수와 카테고리별 집계 정보를 조회한다.")
  public ResponseEntity<ApiResponse<ScanSummaryResponse>> getScanSummary(@PathVariable Long scanId) {
    // 요약 조회도 기본 조회와 동일하게 서비스에서 인가까지 함께 처리한다.
    ScanSummaryResponse data = scanSummaryQueryService.getScanSummary(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_SUMMARY_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}/findings")
  @Operation(
      summary = "스캔 취약점 목록 조회",
      description = "스캔에 속한 취약점 결과 목록을 최신 생성 순으로 조회한다.")
  public ResponseEntity<ApiResponse<ScanFindingListResponseData>> getScanFindings(
      @PathVariable Long scanId,
      @RequestParam(required = false) Severity severity,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) FindingSourceType sourceType,
      @RequestParam(required = false) ResolutionStatus resolutionStatus,
      @RequestParam(required = false) Long scanNodeId,
      @RequestParam(defaultValue = "0") Integer page,
      @RequestParam(defaultValue = "20") Integer size
  ) {
    // 필터와 페이지 조건은 서비스에서 정규화하고, 컨트롤러는 요청 파라미터만 전달한다.
    ScanFindingListResponseData data = scanFindingListQueryService.getScanFindings(
        scanId,
        severity,
        category,
        sourceType,
        resolutionStatus,
        scanNodeId,
        page,
        size
    );
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_FINDINGS_SUCCESS_MESSAGE, data));
  }
}
