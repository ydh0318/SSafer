package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanRequestSource;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record HistoryScanListItemResponse(
    @Schema(description = "Scan ID", example = "1001")
    Long scanId,
    @Schema(description = "Project ID", example = "101")
    Long projectId,
    @Schema(description = "Scan status", example = "DONE")
    ScanStatus status,
    @Schema(description = "Scan mode", example = "AGENT")
    ScanMode scanMode,
    @Schema(description = "Scan request source", example = "CLI", nullable = true)
    ScanRequestSource source,
    @Schema(description = "Scan type", example = "PROJECT_FILE")
    ScanType scanType,
    @Schema(description = "Total finding count", example = "12")
    long totalFindingCount,
    @Schema(description = "Critical finding count", example = "1")
    long criticalCount,
    @Schema(description = "High finding count", example = "3")
    long highCount,
    @Schema(description = "Medium finding count", example = "5")
    long mediumCount,
    @Schema(description = "Low finding count", example = "2")
    long lowCount,
    @Schema(description = "Info finding count", example = "1")
    long infoCount,
    @Schema(description = "Requested time", example = "2026-04-27T09:00:00")
    LocalDateTime requestedAt,
    @Schema(description = "Completed time", example = "2026-04-27T09:10:00")
    LocalDateTime completedAt
) {
}
