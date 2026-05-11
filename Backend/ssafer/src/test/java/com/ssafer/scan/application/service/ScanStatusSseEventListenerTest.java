package com.ssafer.scan.application.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ScanStatusSseEventListenerTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private ScanStatusSseEventPublisher scanStatusSseEventPublisher;

  @InjectMocks
  private ScanStatusSseEventListener scanStatusSseEventListener;

  @Test
  void onRequestedPublishesCompletedEventAfterCommit() {
    Scan scan = terminalScan(ScanStatus.DONE);
    when(scanRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(scan));

    scanStatusSseEventListener.onRequested(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.DONE));

    verify(scanStatusSseEventPublisher).publishCompleted(scan);
  }

  @Test
  void onRequestedPublishesFailedEventAfterCommit() {
    Scan scan = terminalScan(ScanStatus.FAILED);
    when(scanRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(scan));

    scanStatusSseEventListener.onRequested(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.FAILED));

    verify(scanStatusSseEventPublisher).publishFailed(scan);
  }

  @Test
  void onRequestedSkipsWhenCommittedStatusDiffers() {
    Scan scan = terminalScan(ScanStatus.RUNNING);
    when(scanRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(scan));

    scanStatusSseEventListener.onRequested(new ScanStatusSsePublishRequestedEvent(1L, ScanStatus.DONE));

    verify(scanStatusSseEventPublisher, never()).publishCompleted(scan);
    verify(scanStatusSseEventPublisher, never()).publishFailed(scan);
  }

  private Scan terminalScan(ScanStatus status) {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(status)
        .requestedAt(LocalDateTime.of(2026, 5, 11, 17, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 17, 1))
        .build();
  }
}
