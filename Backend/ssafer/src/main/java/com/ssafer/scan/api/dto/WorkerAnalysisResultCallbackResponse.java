package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record WorkerAnalysisResultCallbackResponse(
    @Schema(description = "갱신된 scan ID", example = "1")
    Long scanId,
    @Schema(description = "scan이 속한 프로젝트 ID", example = "10")
    Long projectId,
    @Schema(description = "scan 실행 방식", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "현재 scan 상태", example = "RUNNING")
    ScanStatus status,
    @Schema(description = "현재 적재 중인 분석 결과 파일 경로", example = "s3://ssafer/result/1/analysis_result.json")
    String analysisResultPath,
    @Schema(description = "scan 요청 시각", example = "2026-04-27T08:55:00")
    LocalDateTime requestedAt,
    @Schema(description = "마지막 상태 갱신 시각", example = "2026-04-27T09:05:00")
    LocalDateTime lastUpdatedAt
) {
}
