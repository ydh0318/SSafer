package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * 스캔 기본 조회에서 사용하는 응답 DTO다.
 * 결과 목록/요약보다 앞서 스캔 메타데이터와 현재 상태를 보여주는 데 사용한다.
 */
public record ScanBasicResponse(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "스캔 실행 방식", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "현재 스캔 상태", example = "RAW_UPLOADED")
    ScanStatus status,
    @Schema(description = "현재 처리 단계", example = "uploaded")
    String progressStep,
    @Schema(description = "실패 사유", example = "S3 upload failed")
    String failureReason,
    @Schema(description = "원본 결과 파일 경로", example = "s3://ssafer/raw/1001/scan_result.json")
    String rawResultPath,
    @Schema(description = "스캔 요청 시각", example = "2026-04-23T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "스캔 시작 시각", example = "2026-04-23T09:01:00")
    LocalDateTime startedAt,
    @Schema(description = "스캔 완료 시각", example = "2026-04-23T09:03:00")
    LocalDateTime completedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-23T09:03:00")
    LocalDateTime lastUpdatedAt) {
}
