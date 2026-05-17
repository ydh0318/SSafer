package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LocalAgentScanRequest(
    @Schema(description = "Local Agent scan target path", example = "/opt/app")
    @NotBlank
    @Size(max = 500)
    String targetPath,

    @Schema(description = "Scan display name", example = "운영 서버 점검", nullable = true)
    @Size(max = 255)
    String scanName,

    @Schema(description = "Scan type", example = "PROJECT_FILE", nullable = true)
    ScanType scanType,

    @Schema(description = "Whether to include logs", example = "false", nullable = true)
    Boolean includeLogs
) {
}
