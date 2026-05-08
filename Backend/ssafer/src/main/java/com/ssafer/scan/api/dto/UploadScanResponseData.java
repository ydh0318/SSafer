package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record UploadScanResponseData(
    @Schema(description = "생성된 scan ID", example = "1001")
    Long scanId,
    @Schema(description = "현재 scan 상태", example = "QUEUED")
    ScanStatus status,
    @Schema(description = "실패 사유(enum name)", example = "ANALYSIS_QUEUE_PUBLISH_FAILED")
    ScanFailureReason failureReason
) {
}
