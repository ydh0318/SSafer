package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.application.service.ScanFindingListQueryService;
import com.ssafer.scan.application.service.ScanSummaryQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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
  public ResponseEntity<ApiResponse<List<ScanFindingListItemResponse>>> getScanFindings(
      @PathVariable Long scanId) {
    // 필터와 페이지네이션은 다음 단계에서 확장하고, 현재는 목록 조회 뼈대와 인가 흐름을 먼저 고정한다.
    List<ScanFindingListItemResponse> data = scanFindingListQueryService.getScanFindings(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_FINDINGS_SUCCESS_MESSAGE, data));
  }
}
