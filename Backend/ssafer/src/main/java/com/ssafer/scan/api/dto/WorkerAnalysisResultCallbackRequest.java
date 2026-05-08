package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 워커가 분석 진행 상태 또는 최종 결과를 백엔드에 알릴 때 사용하는 내부 콜백 요청이다.
 * RUNNING 콜백은 "작업을 받아 실제 분석을 시작했다"는 뜻이고,
 * DONE/FAILED 콜백은 최종 결과를 의미한다.
 */
public record WorkerAnalysisResultCallbackRequest(
    @Schema(description = "완료 처리할 agent task ID", example = "123")
    @NotNull(message = "taskId is required")
    Long taskId,
    @Schema(description = "워커 분석 상태", example = "RUNNING")
    ScanStatus status,
    @Schema(description = "워커가 전달하는 현재 처리 단계", example = "analysis_started")
    @Size(max = 100) String progressStep,
    @Schema(description = "실패 시 기록할 사유", example = "worker analysis failed")
    String failureReason,
    @Schema(description = "S3에 저장된 분석 결과 파일 경로", example = "s3://ssafer/result/1/analysis_result.json")
    @Size(max = 500) String analysisResultPath,
    @Schema(description = "워커 분석 시작 시각", example = "2026-04-27T09:00:00")
    LocalDateTime startedAt,
    @Schema(description = "워커 분석 종료 시각", example = "2026-04-27T09:05:00")
    LocalDateTime completedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-27T09:05:00")
    LocalDateTime lastUpdatedAt
) {

  @AssertTrue(message = "DONE status requires analysisResultPath")
  public boolean hasAnalysisResultPathForSuccess() {
    return status != ScanStatus.DONE || hasText(analysisResultPath);
  }

  @AssertTrue(message = "FAILED status requires failureReason")
  public boolean hasFailureReasonForFailedStatus() {
    return status != ScanStatus.FAILED || hasText(failureReason);
  }

  @AssertTrue(message = "status only supports RUNNING, DONE or FAILED")
  public boolean hasSupportedStatus() {
    return status == null || status == ScanStatus.RUNNING || status == ScanStatus.DONE || status == ScanStatus.FAILED;
  }

  @AssertTrue(message = "startedAt must be before or equal to completedAt")
  public boolean isTimeRangeValid() {
    return startedAt == null || completedAt == null || !startedAt.isAfter(completedAt);
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
