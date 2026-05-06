package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 워커가 분석 완료 또는 실패를 백엔드에 알릴 때 사용하는 내부 콜백 요청이다.
 * 성공 콜백이면 analysisResultPath를 보내고, 실패 콜백이면 failureReason을 보낸다.
 */
public record WorkerAnalysisResultCallbackRequest(
    @Schema(description = "완료 처리할 agent task ID", example = "123")
    @NotNull(message = "taskId is required")
    Long taskId,
    @Schema(description = "워커 분석 결과 상태", example = "DONE")
    ScanStatus status,
    @Schema(description = "워커가 전달하는 현재 처리 단계", example = "analysis_completed")
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
    return !isSuccessStatus(status) || hasText(analysisResultPath);
  }

  @AssertTrue(message = "FAILED status requires failureReason")
  public boolean hasFailureReasonForFailedStatus() {
    return status != ScanStatus.FAILED || hasText(failureReason);
  }

  @AssertTrue(message = "status only supports DONE or FAILED")
  public boolean hasSupportedStatus() {
    return status == null || status == ScanStatus.DONE || status == ScanStatus.FAILED;
  }

  @AssertTrue(message = "startedAt must be before or equal to completedAt")
  public boolean isTimeRangeValid() {
    return startedAt == null || completedAt == null || !startedAt.isAfter(completedAt);
  }

  private boolean isSuccessStatus(ScanStatus status) {
    // status를 생략하면 워커 분석 성공 콜백으로 해석한다.
    return status == null || status == ScanStatus.DONE;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
