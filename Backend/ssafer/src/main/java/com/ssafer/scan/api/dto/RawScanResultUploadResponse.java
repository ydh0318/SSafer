package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record RawScanResultUploadResponse(
    @Schema(description = "갱신된 스캔 ID", example = "1")
    Long scanId,
    @Schema(description = "스캔이 속한 프로젝트 ID", example = "10")
    Long projectId,
    @Schema(description = "스캔 실행 방식", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "현재 스캔 상태", example = "RAW_UPLOADED")
    ScanStatus status,
    @Schema(description = "저장된 raw 결과 파일 경로", example = "s3://ssafer/raw/1/scan_result.json")
    String rawResultPath,
    @Schema(description = "스캔 요청 시각", example = "2026-04-27T08:55:00")
    LocalDateTime requestedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-27T09:05:00")
    LocalDateTime lastUpdatedAt) {
}
