package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 워커가 분석 완료 또는 실패를 백엔드에 알릴 때 사용하는 내부 콜백 요청이다.
 * 현재 단계에서는 상태와 결과 경로만 전달하고, 실제 결과 적재는 후속 작업에서 수행한다.
 */
public record WorkerAnalysisResultCallbackRequest(
    @Schema(description = "분석 완료 후 반영할 상태", example = "RAW_UPLOADED")
    ScanStatus status,
    @Schema(description = "현재 처리 단계를 나타내는 값", example = "analysis_completed")
    @Size(max = 100) String progressStep,
    @Schema(description = "실패 시 기록할 사유", example = "worker analysis failed")
    String failureReason,
    @Schema(description = "S3에 저장된 분석 결과 파일 경로", example = "s3://ssafer/raw/1/scan_result.json")
    @Size(max = 500) String rawResultPath,
    @Schema(description = "워커 분석 시작 시각", example = "2026-04-27T09:00:00")
    LocalDateTime startedAt,
    @Schema(description = "워커 분석 종료 시각", example = "2026-04-27T09:05:00")
    LocalDateTime completedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-27T09:05:00")
    LocalDateTime lastUpdatedAt
) {

  @AssertTrue(message = "RAW_UPLOADED status requires rawResultPath")
  public boolean hasRawResultPathForSuccess() {
    return !isSuccessStatus(status) || hasText(rawResultPath);
  }

  @AssertTrue(message = "completedAt is only allowed for FAILED status")
  public boolean isCompletedAtCompatibleWithStatus() {
    return completedAt == null || status == ScanStatus.FAILED;
  }

  @AssertTrue(message = "FAILED status requires failureReason")
  public boolean hasFailureReasonForFailedStatus() {
    return status != ScanStatus.FAILED || hasText(failureReason);
  }

  @AssertTrue(message = "startedAt must be before or equal to completedAt")
  public boolean isTimeRangeValid() {
    return startedAt == null || completedAt == null || !startedAt.isAfter(completedAt);
  }

  private boolean isSuccessStatus(ScanStatus status) {
    // 상태를 생략하면 서비스는 기본 성공 경로인 RAW_UPLOADED로 해석한다.
    return status == null || status == ScanStatus.RAW_UPLOADED;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
