package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;

// 완료 알림 접수 후 반환하는 최소 상태 정보다.
public record CliRawResultUploadReportResponseData(
    @Schema(description = "scan ID", example = "1001")
    Long scanId,
    @Schema(description = "현재 scan 상태", example = "QUEUED")
    ScanStatus status,
    @Schema(description = "raw 결과 개수", example = "152")
    Integer resultCount
) {
}
