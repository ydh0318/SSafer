package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Slf4j
@RequiredArgsConstructor
public class UploadScanStatusUpdater {

  private static final String EXECUTION_FAILED_PROGRESS_STEP = "UPLOAD_SCAN_EXECUTION_FAILED";

  private final ScanRepository scanRepository;

  @Transactional
  public void markExecutionFailed(Long scanId, ScanFailureReason failureReason) {
    // 상태 충돌 방지를 위해 REQUESTED 상태일 때만 FAILED 전이를 시도한다.
    LocalDateTime now = LocalDateTime.now();
    int updatedRows = scanRepository.updateStatusIfCurrent(
        scanId,
        ScanStatus.REQUESTED,
        ScanStatus.FAILED,
        EXECUTION_FAILED_PROGRESS_STEP,
        failureReason.name(),
        now,
        now,
        now
    );

    if (updatedRows != 1) {
      log.warn(
          "Upload scan status conflict while marking FAILED: scanId={}, expectedStatus={}, updatedRows={}",
          scanId,
          ScanStatus.REQUESTED,
          updatedRows
      );
    }
  }
}
