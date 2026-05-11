package com.ssafer.scan.application.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class UploadScanStatusUpdaterTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private ApplicationEventPublisher applicationEventPublisher;

  @InjectMocks
  private UploadScanStatusUpdater uploadScanStatusUpdater;

  @Test
  void markExecutionFailedPublishesFailedEvent() {
    when(scanRepository.updateStatusIfCurrent(
        org.mockito.ArgumentMatchers.eq(1L),
        org.mockito.ArgumentMatchers.eq(ScanStatus.REQUESTED),
        org.mockito.ArgumentMatchers.eq(ScanStatus.FAILED),
        org.mockito.ArgumentMatchers.eq("UPLOAD_SCAN_EXECUTION_FAILED"),
        org.mockito.ArgumentMatchers.eq(ScanFailureReason.SCAN_EXECUTION_FAILED.name()),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any()
    )).thenReturn(1);

    uploadScanStatusUpdater.markExecutionFailed(1L, ScanFailureReason.SCAN_EXECUTION_FAILED);

    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  @Test
  void markUploadFailedPublishesFailedEvent() {
    when(scanRepository.updateStatusIfCurrent(
        org.mockito.ArgumentMatchers.eq(1L),
        org.mockito.ArgumentMatchers.eq(ScanStatus.REQUESTED),
        org.mockito.ArgumentMatchers.eq(ScanStatus.FAILED),
        org.mockito.ArgumentMatchers.eq("UPLOAD_RAW_RESULT_UPLOAD_FAILED"),
        org.mockito.ArgumentMatchers.eq(ScanFailureReason.RAW_RESULT_UPLOAD_FAILED.name()),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any()
    )).thenReturn(1);

    uploadScanStatusUpdater.markUploadFailed(1L, ScanFailureReason.RAW_RESULT_UPLOAD_FAILED);

    verify(applicationEventPublisher).publishEvent(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));
  }

  @Test
  void markQueuePublishFailedDoesNotPublishFailedEvent() {
    when(scanRepository.updateStatusIfCurrent(
        org.mockito.ArgumentMatchers.eq(1L),
        org.mockito.ArgumentMatchers.eq(ScanStatus.RAW_UPLOADED),
        org.mockito.ArgumentMatchers.eq(ScanStatus.RAW_UPLOADED),
        org.mockito.ArgumentMatchers.eq("UPLOAD_ANALYSIS_QUEUE_PUBLISH_FAILED"),
        org.mockito.ArgumentMatchers.eq(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED.name()),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.any()
    )).thenReturn(1);

    uploadScanStatusUpdater.markQueuePublishFailed(1L, ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);

    verify(applicationEventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
  }
}
