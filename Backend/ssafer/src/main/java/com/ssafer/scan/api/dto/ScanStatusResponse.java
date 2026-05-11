package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanRequestSource;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record ScanStatusResponse(
    @Schema(description = "Scan ID", example = "1001")
    Long scanId,
    @Schema(description = "Current scan status", example = "RUNNING")
    ScanStatus status,
    @Schema(description = "Scan request source", example = "CLI", nullable = true)
    ScanRequestSource source,
    @Schema(description = "Scan type", example = "PROJECT_FILE")
    ScanType scanType,
    @Schema(description = "Current progress step", example = "ANALYSIS_RUNNING")
    String progressStep,
    @Schema(description = "Requested time", example = "2026-04-27T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "Started time", example = "2026-04-27T09:01:00")
    LocalDateTime startedAt,
    @Schema(description = "Completed time", example = "2026-04-27T09:10:00")
    LocalDateTime completedAt,
    @Schema(description = "Failure reason", example = "Agent connection timeout")
    String errorMessage
) {
}
