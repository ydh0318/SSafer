package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.api.dto.ScanFindingListResponseData;
import com.ssafer.scan.api.dto.ScanStatusResponse;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.application.service.ScanCompareQueryService;
import com.ssafer.scan.application.service.ScanFindingDetailQueryService;
import com.ssafer.scan.application.service.ScanFindingListQueryService;
import com.ssafer.scan.application.service.ScanStatusQueryService;
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

@Tag(name = "스캔 결과 조회", description = "스캔 결과 메타데이터, 비교, 요약, 상세 결과를 조회하는 API")
@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
public class ScanQueryController {

  private static final String GET_SCAN_BASIC_SUCCESS_MESSAGE = "스캔 기본 조회 성공";
  private static final String GET_SCAN_STATUS_SUCCESS_MESSAGE = "스캔 진행 상태 조회 성공";
  private static final String GET_SCAN_SUMMARY_SUCCESS_MESSAGE = "스캔 결과 요약 조회 성공";
  private static final String GET_SCAN_FINDINGS_SUCCESS_MESSAGE = "스캔 취약점 목록 조회 성공";
  private static final String GET_SCAN_FINDING_DETAIL_SUCCESS_MESSAGE = "스캔 취약점 상세 조회 성공";
  private static final String GET_SCAN_COMPARE_SUCCESS_MESSAGE = "스캔 결과 비교 조회 성공";

  private final ScanCompareQueryService scanCompareQueryService;
  private final ScanBasicQueryService scanBasicQueryService;
  private final ScanStatusQueryService scanStatusQueryService;
  private final ScanSummaryQueryService scanSummaryQueryService;
  private final ScanFindingListQueryService scanFindingListQueryService;
  private final ScanFindingDetailQueryService scanFindingDetailQueryService;

  @GetMapping("/compare")
  @Operation(summary = "스캔 결과 비교", description = "기준 스캔과 대상 스캔의 권한을 검증하고 비교 기본 정보를 조회합니다.")
  public ResponseEntity<ApiResponse<ScanCompareResponse>> compareScans(
      @RequestParam Long baseScanId,
      @RequestParam Long targetScanId
  ) {
    ScanCompareResponse data = scanCompareQueryService.compare(baseScanId, targetScanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_COMPARE_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}")
  @Operation(summary = "스캔 기본 조회", description = "스캔의 기본 메타데이터와 현재 진행 상태를 조회합니다.")
  public ResponseEntity<ApiResponse<ScanBasicResponse>> getScanBasic(@PathVariable Long scanId) {
    ScanBasicResponse data = scanBasicQueryService.getScanBasic(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_BASIC_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}/status")
  @Operation(summary = "스캔 진행 상태 조회", description = "스캔의 현재 상태와 진행 단계를 조회합니다.")
  public ResponseEntity<ApiResponse<ScanStatusResponse>> getScanStatus(@PathVariable Long scanId) {
    // 상태 조회의 비즈니스 규칙은 서비스에서 처리하고, 컨트롤러는 입출력만 담당한다.
    ScanStatusResponse data = scanStatusQueryService.getScanStatus(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_STATUS_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}/summary")
  @Operation(summary = "스캔 결과 요약 조회", description = "스캔 결과의 전체 개수와 분포 통계를 조회합니다.")
  public ResponseEntity<ApiResponse<ScanSummaryResponse>> getScanSummary(@PathVariable Long scanId) {
    ScanSummaryResponse data = scanSummaryQueryService.getScanSummary(scanId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_SUMMARY_SUCCESS_MESSAGE, data));
  }

  @GetMapping("/{scanId}/findings")
  @Operation(
      summary = "스캔 취약점 목록 조회",
      description = "스캔의 취약점 결과 목록을 필터와 페이지 조건으로 조회합니다."
  )
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

  @GetMapping("/{scanId}/findings/{findingId}")
  @Operation(summary = "스캔 취약점 상세 조회", description = "스캔의 특정 취약점 결과 상세 정보를 조회합니다.")
  public ResponseEntity<ApiResponse<ScanFindingDetailResponse>> getScanFindingDetail(
      @PathVariable Long scanId,
      @PathVariable Long findingId
  ) {
    ScanFindingDetailResponse data = scanFindingDetailQueryService.getScanFindingDetail(scanId, findingId);
    return ResponseEntity.ok(ApiResponse.success(GET_SCAN_FINDING_DETAIL_SUCCESS_MESSAGE, data));
  }
}
