package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.scan.api.dto.RawScanResultUploadRequest;
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
class ScanRawResultUploadServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @InjectMocks
  private ScanRawResultUploadService scanRawResultUploadService;

  @Test
  void uploadWithoutStatusDefaultsToRawUploaded() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        null,
        "uploaded",
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    Scan saved = scanRawResultUploadService.upload(1L, request);

    assertThat(saved.getStatus()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(saved.getRawResultPath()).isEqualTo("s3://ssafer/raw/1/scan_result.json");
    assertThat(saved.getStartedAt()).isEqualTo(startedAt);
    assertThat(saved.getCompletedAt()).isNull();
    assertThat(saved.getLastUpdatedAt()).isNotNull();
    verify(scanRepository).findById(1L);
  }

  @Test
  void uploadFailedStatusWithoutCompletedAtBackfillsCompletedAt() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.FAILED,
        "upload_failed",
        "S3 upload failed",
        null,
        null,
        null,
        null);

    Scan saved = scanRawResultUploadService.upload(1L, request);

    assertThat(saved.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(saved.getFailureReason()).isEqualTo("S3 upload failed");
    assertThat(saved.getCompletedAt()).isEqualTo(saved.getLastUpdatedAt());
    assertThat(saved.getStartedAt()).isEqualTo(saved.getCompletedAt());
  }

  @Test
  void uploadRawUploadedStatusRejectsCompletedAt() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        LocalDateTime.of(2026, 4, 24, 15, 10),
        null);

    assertThatThrownBy(() -> scanRawResultUploadService.upload(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }

  @Test
  void uploadWhenScanMissingThrowsNotFound() {
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/999/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> scanRawResultUploadService.upload(999L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void uploadWhenExistingScanIsTerminalThrowsConflict() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> scanRawResultUploadService.upload(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }

  @Test
  void uploadWhenExistingScanIsAlreadyRawUploadedThrowsConflict() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> scanRawResultUploadService.upload(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }

  @Test
  void uploadFailedStatusWithoutFailureReasonThrowsBadRequest() {
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

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.FAILED,
        null,
        null,
        null,
        null,
        null,
        null);

    assertThatThrownBy(() -> scanRawResultUploadService.upload(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }
}
