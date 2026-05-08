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
 * 워커가 분석 시작(RUNNING) 또는 최종 결과(DONE/FAILED)를 백엔드에 알리는 내부 콜백 API다.
 */
@Tag(name = "워커 분석 결과 콜백", description = "워커가 분석 진행 상태와 최종 결과를 전달하는 내부 API")
@RestController
@RequestMapping("/api/v1/internal/scans")
@RequiredArgsConstructor
public class WorkerAnalysisResultController {

  private final WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @PostMapping("/{scanId}/analysis-results")
  @Operation(
      summary = "워커 분석 상태 콜백",
      description = "워커가 분석을 시작하면 RUNNING 상태를 알리고, 최종 완료 시 DONE/FAILED 상태와 결과 경로를 전달합니다."
  )
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
        scan.getAnalysisResultPath(),
        scan.getRequestedAt(),
        scan.getLastUpdatedAt()
    );

    return ResponseEntity.ok(response);
  }
}
