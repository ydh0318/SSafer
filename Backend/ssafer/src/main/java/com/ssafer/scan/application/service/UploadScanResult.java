package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.ScanStatus;

public record UploadScanResult(
    Long scanId,
    ScanStatus status
) {
}
