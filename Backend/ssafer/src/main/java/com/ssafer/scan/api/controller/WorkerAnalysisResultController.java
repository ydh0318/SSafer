package com.ssafer.scan.api.controller;

import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackResponse;
import com.ssafer.scan.application.service.WorkerAnalysisResultCallbackService;
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
 * 워커가 분석 완료 또는 실패를 백엔드에 알리는 내부 콜백 API다.
 * 현재 단계에서는 scan 상태와 S3 결과 경로만 반영하고, 실제 결과 적재는 다음 작업에서 이어진다.
 */
@Tag(name = "워커 분석 결과 콜백", description = "워커가 분석 완료 상태를 전달하는 내부 API")
@RestController
@RequestMapping("/api/v1/internal/scans")
@RequiredArgsConstructor
public class WorkerAnalysisResultController {

  private final WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @PostMapping("/{scanId}/analysis-results")
  @Operation(
      summary = "워커 분석 완료 알림",
      description = "워커가 분석 결과 파일 처리를 마친 뒤 scan 상태와 결과 경로를 반영한다.")
  public ResponseEntity<WorkerAnalysisResultCallbackResponse> reportAnalysisResult(
      @PathVariable Long scanId,
      @Valid @RequestBody WorkerAnalysisResultCallbackRequest request
  ) {
    Scan scan = workerAnalysisResultCallbackService.report(scanId, request);

    WorkerAnalysisResultCallbackResponse response = new WorkerAnalysisResultCallbackResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getScanMode(),
        scan.getStatus(),
        scan.getRawResultPath(),
        scan.getRequestedAt(),
        scan.getLastUpdatedAt()
    );

    return ResponseEntity.ok(response);
  }
}
