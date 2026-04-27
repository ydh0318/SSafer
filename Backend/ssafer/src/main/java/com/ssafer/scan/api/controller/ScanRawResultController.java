package com.ssafer.scan.api.controller;

import com.ssafer.scan.api.dto.RawScanResultUploadRequest;
import com.ssafer.scan.api.dto.RawScanResultUploadResponse;
import com.ssafer.scan.application.service.ScanRawResultUploadService;
import com.ssafer.scan.domain.entity.Scan;
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

/**
 * 에이전트가 raw 스캔 산출물을 S3에 업로드한 뒤 호출하는 내부 콜백 API다.
 * 이 엔드포인트는 산출물 경로와 업로드 결과 상태만 scan row에 반영한다.
 */
@Tag(name = "스캔 결과 적재", description = "에이전트와 분석기가 전달하는 스캔 결과 적재 API")
@RestController
@RequestMapping("/api/v1/internal/scans")
@RequiredArgsConstructor
public class ScanRawResultController {

  private final ScanRawResultUploadService scanRawResultUploadService;

  @PostMapping("/{scanId}/raw-results")
  @Operation(
      summary = "Raw 결과 업로드 완료 콜백",
      description = "에이전트가 raw 스캔 결과 파일을 S3에 올린 뒤 scan 상태와 S3 경로를 반영한다.")
  public ResponseEntity<RawScanResultUploadResponse> uploadRawResult(
      @PathVariable Long scanId,
      @Valid @RequestBody RawScanResultUploadRequest request) {
    Scan scan = scanRawResultUploadService.upload(scanId, request);

    RawScanResultUploadResponse response = new RawScanResultUploadResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getScanMode(),
        scan.getStatus(),
        scan.getRawResultPath(),
        scan.getRequestedAt(),
        scan.getLastUpdatedAt());

    return ResponseEntity.ok(response);
  }
}
