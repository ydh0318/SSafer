package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanRequestSource;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record ScanBasicResponse(
    @Schema(description = "Scan ID", example = "1001")
    Long scanId,
    @Schema(description = "Project ID", example = "101")
    Long projectId,
    @Schema(description = "Scan mode", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "Scan request source", example = "CLI", nullable = true)
    ScanRequestSource source,
    @Schema(description = "Scan type", example = "PROJECT_FILE")
    ScanType scanType,
    @Schema(description = "Current scan status", example = "RAW_UPLOADED")
    ScanStatus status,
    @Schema(description = "Current progress step", example = "uploaded")
    String progressStep,
    @Schema(description = "Failure reason", example = "S3 upload failed")
    String failureReason,
    @Schema(description = "Raw result path", example = "s3://ssafer/raw/1001/scan_result.json")
    String rawResultPath,
    @Schema(description = "Requested time", example = "2026-04-23T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "Started time", example = "2026-04-23T09:01:00")
    LocalDateTime startedAt,
    @Schema(description = "Completed time", example = "2026-04-23T09:03:00")
    LocalDateTime completedAt,
    @Schema(description = "Last updated time", example = "2026-04-23T09:03:00")
    LocalDateTime lastUpdatedAt
) {
}
