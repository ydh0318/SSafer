package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultCallbackServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @InjectMocks
  private WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @Test
  void reportWithoutStatusDefaultsToRawUploaded() {
    LocalDateTime startedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(startedAt.minusMinutes(5))
        .startedAt(startedAt)
        .lastUpdatedAt(startedAt.minusMinutes(1))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        null,
        "analysis_completed",
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    Scan saved = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(saved.getStatus()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(saved.getRawResultPath()).isEqualTo("s3://ssafer/raw/1/scan_result.json");
    assertThat(saved.getStartedAt()).isEqualTo(startedAt);
    assertThat(saved.getCompletedAt()).isNull();
    assertThat(saved.getLastUpdatedAt()).isNotNull();
    verify(scanRepository).findById(1L);
  }

  @Test
  void reportFailedStatusWithoutCompletedAtBackfillsCompletedAt() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(requestedAt)
        .lastUpdatedAt(requestedAt.plusMinutes(1))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.FAILED,
        "analysis_failed",
        "worker analysis failed",
        null,
        null,
        null,
        null);

    Scan saved = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(saved.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(saved.getFailureReason()).isEqualTo("worker analysis failed");
    assertThat(saved.getCompletedAt()).isEqualTo(saved.getLastUpdatedAt());
    assertThat(saved.getStartedAt()).isEqualTo(saved.getCompletedAt());
  }

  @Test
  void reportRawUploadedStatusRejectsCompletedAt() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        LocalDateTime.of(2026, 4, 24, 15, 10),
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }

  @Test
  void reportWhenScanMissingThrowsNotFound() {
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/999/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(999L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void reportWhenExistingScanIsTerminalThrowsConflict() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }

  @Test
  void reportWhenExistingScanIsAlreadyRawUploadedThrowsConflict() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RAW_UPLOADED)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }

  @Test
  void reportFailedStatusWithoutFailureReasonThrowsBadRequest() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();

    when(scanRepository.findById(1L)).thenReturn(Optional.of(existing));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        ScanStatus.FAILED,
        null,
        null,
        null,
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }
}
