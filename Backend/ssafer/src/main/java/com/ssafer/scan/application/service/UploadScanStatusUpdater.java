package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Slf4j
@RequiredArgsConstructor
public class UploadScanStatusUpdater {

  private static final String RAW_UPLOADED_PROGRESS_STEP = "UPLOAD_RAW_RESULT_UPLOADED";
  private static final String QUEUED_PROGRESS_STEP = "UPLOAD_ANALYSIS_QUEUED";
  private static final String EXECUTION_FAILED_PROGRESS_STEP = "UPLOAD_SCAN_EXECUTION_FAILED";
  private static final String RAW_UPLOAD_FAILED_PROGRESS_STEP = "UPLOAD_RAW_RESULT_UPLOAD_FAILED";
  private static final String QUEUE_PUBLISH_FAILED_PROGRESS_STEP = "UPLOAD_ANALYSIS_QUEUE_PUBLISH_FAILED";

  private final ScanRepository scanRepository;
  private final ApplicationEventPublisher applicationEventPublisher;

  @Transactional
  public void markRawUploaded(Long scanId, String rawResultPath) {
    LocalDateTime now = LocalDateTime.now();
    int updatedRows = scanRepository.updateRawResultPathAndStatusIfCurrent(
        scanId,
        rawResultPath,
        ScanStatus.REQUESTED,
        ScanStatus.RAW_UPLOADED,
        RAW_UPLOADED_PROGRESS_STEP,
        null,
        now,
        null,
        now
    );
    if (updatedRows != 1) {
      log.warn(
          "Upload scan status conflict while marking RAW_UPLOADED: scanId={}, expectedStatus={}, updatedRows={}",
          scanId,
          ScanStatus.REQUESTED,
          updatedRows
      );
    }
  }

  @Transactional
  public void markQueued(Long scanId) {
    LocalDateTime now = LocalDateTime.now();
    int updatedRows = scanRepository.updateStatusIfCurrent(
        scanId,
        ScanStatus.RAW_UPLOADED,
        ScanStatus.QUEUED,
        QUEUED_PROGRESS_STEP,
        null,
        now,
        null,
        now
    );
    if (updatedRows != 1) {
      log.warn(
          "Upload scan status conflict while marking QUEUED: scanId={}, expectedStatus={}, updatedRows={}",
          scanId,
          ScanStatus.RAW_UPLOADED,
          updatedRows
      );
    }
  }

  @Transactional
  public void markExecutionFailed(Long scanId, ScanFailureReason failureReason) {
    markFailedFromRequested(scanId, failureReason, EXECUTION_FAILED_PROGRESS_STEP);
  }

  @Transactional
  public void markUploadFailed(Long scanId, ScanFailureReason failureReason) {
    markFailedFromRequested(scanId, failureReason, RAW_UPLOAD_FAILED_PROGRESS_STEP);
  }

  @Transactional
  public void markQueuePublishFailed(Long scanId, ScanFailureReason failureReason) {
    LocalDateTime now = LocalDateTime.now();
    int updatedRows = scanRepository.updateStatusIfCurrent(
        scanId,
        ScanStatus.RAW_UPLOADED,
        ScanStatus.RAW_UPLOADED,
        QUEUE_PUBLISH_FAILED_PROGRESS_STEP,
        failureReason.name(),
        now,
        null,
        now
    );
    if (updatedRows != 1) {
      log.warn(
          "Upload scan status conflict while keeping RAW_UPLOADED after MQ failure: scanId={}, expectedStatus={}, updatedRows={}",
          scanId,
          ScanStatus.RAW_UPLOADED,
          updatedRows
      );
    }
  }

  private void markFailedFromRequested(Long scanId, ScanFailureReason failureReason, String progressStep) {
    LocalDateTime now = LocalDateTime.now();
    int updatedRows = scanRepository.updateStatusIfCurrent(
        scanId,
        ScanStatus.REQUESTED,
        ScanStatus.FAILED,
        progressStep,
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
      return;
    }

    // upload 선행 단계 최종 실패도 커밋 이후 SSE 실패 이벤트를 보내서 상태 재조회 타이밍을 맞춘다.
    applicationEventPublisher.publishEvent(new ScanStatusSsePublishRequestedEvent(scanId, ScanStatus.FAILED));
  }
}
