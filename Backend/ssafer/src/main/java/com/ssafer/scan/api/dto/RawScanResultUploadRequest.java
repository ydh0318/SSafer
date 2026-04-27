package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 에이전트가 raw 산출물을 S3에 저장한 뒤 Spring에 보내는 콜백 요청이다.
 * 정상 경로는 S3 객체 경로를 전달하고, FAILED 경로는 업로드 흐름이 왜 끝났는지 전달한다.
 */
public record RawScanResultUploadRequest(
    @Schema(description = "업로드 완료 후 반영할 상태", example = "RAW_UPLOADED")
    ScanStatus status,
    @Schema(description = "현재 처리 단계를 짧게 표현한 값", example = "uploaded")
    @Size(max = 100) String progressStep,
    @Schema(description = "실패 시 기록할 사유", example = "S3 upload failed")
    String failureReason,
    @Schema(description = "S3에 저장된 raw 결과 파일 경로", example = "s3://ssafer/raw/1/scan_result.json")
    @Size(max = 500) String rawResultPath,
    @Schema(description = "에이전트 스캔 시작 시각", example = "2026-04-27T09:00:00")
    LocalDateTime startedAt,
    @Schema(description = "실패 처리 완료 시각", example = "2026-04-27T09:05:00")
    LocalDateTime completedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-27T09:05:00")
    LocalDateTime lastUpdatedAt) {

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
