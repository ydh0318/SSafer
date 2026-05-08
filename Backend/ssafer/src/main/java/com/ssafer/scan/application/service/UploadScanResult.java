package com.ssafer.scan.application.service;

import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;

public record UploadScanResult(
    Long scanId,
    ScanStatus status,
    ScanFailureReason failureReason,
    ErrorCode errorCode
) {

  public boolean isSuccess() {
    return status == ScanStatus.QUEUED;
  }
}
