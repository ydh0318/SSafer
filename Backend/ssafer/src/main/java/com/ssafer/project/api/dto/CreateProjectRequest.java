package com.ssafer.project.api.dto;

import com.ssafer.project.domain.enums.ScanMode;
import io.swagger.v3.oas.annotations.media.Schema;

public record CreateProjectRequest(
    @Schema(description = "프로젝트 이름", example = "운영 서버 점검")
    String name,
    @Schema(description = "프로젝트 설명(선택)", example = "1차 보안 점검 프로젝트", nullable = true)
    String description,
    @Schema(description = "기본 스캔 모드(UPLOAD, AGENT)", example = "AGENT", nullable = true)
    ScanMode defaultScanMode,
    @Schema(description = "모니터링 사용 여부", example = "false", nullable = true)
    Boolean monitorEnabled
) {
}
