package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanRequestSource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 스캔 시작 API(POST /api/v1/scans) 요청 본문.
public record CreateScanRequest(
    @Schema(description = "프로젝트 이름", example = "sample-app")
    @NotBlank
    @Size(max = 255)
    String projectName,

    @Schema(description = "스캔 요청 출처", example = "AGENT")
    @NotNull
    ScanRequestSource source,

    @Schema(description = "스캔 이름", example = "로컬 서버 점검", nullable = true)
    @Size(max = 255)
    String scanName,

    @Schema(description = "점검 대상 경로", example = "/opt/app", nullable = true)
    @Size(max = 500)
    String targetPath,

    @Schema(description = "로그 포함 여부", example = "false", nullable = true)
    Boolean includeLogs
) {
}
