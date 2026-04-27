package com.ssafer.project.api.dto;

import com.ssafer.project.domain.enums.ScanMode;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public record ProjectDetailResponseData(
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "프로젝트 이름", example = "운영 서버 점검")
    String name,
    @Schema(description = "프로젝트 설명", example = "1차 보안 점검 프로젝트", nullable = true)
    String description,
    @Schema(description = "기본 스캔 모드", example = "AGENT")
    ScanMode defaultScanMode,
    @Schema(description = "모니터링 사용 여부", example = "false")
    boolean monitorEnabled,
    @Schema(description = "생성 시각(UTC)", example = "2026-04-23T09:00:00Z")
    Instant createdAt,
    @Schema(description = "수정 시각(UTC)", example = "2026-04-23T09:10:00Z")
    Instant updatedAt
) {
}
