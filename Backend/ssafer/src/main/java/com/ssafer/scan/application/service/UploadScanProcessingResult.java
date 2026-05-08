package com.ssafer.scan.application.service;

import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;

public record UploadScanProcessingResult(
    ScanStatus status,
    ScanFailureReason failureReason,
    ErrorCode errorCode
) {

  public static UploadScanProcessingResult queued() {
    return new UploadScanProcessingResult(ScanStatus.QUEUED, null, null);
  }

  public static UploadScanProcessingResult failed(ScanFailureReason failureReason, ErrorCode errorCode) {
    return new UploadScanProcessingResult(ScanStatus.FAILED, failureReason, errorCode);
  }

  public static UploadScanProcessingResult rawUploadedFailed(ScanFailureReason failureReason, ErrorCode errorCode) {
    return new UploadScanProcessingResult(ScanStatus.RAW_UPLOADED, failureReason, errorCode);
  }

  public boolean isSuccess() {
    return status == ScanStatus.QUEUED;
  }
}
