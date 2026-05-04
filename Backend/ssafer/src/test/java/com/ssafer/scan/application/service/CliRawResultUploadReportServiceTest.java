package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class CliRawResultUploadReportServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private RawResultObjectVerifier rawResultObjectVerifier;
  @Mock
  private ObjectMapper objectMapper;

  @InjectMocks
  private CliRawResultUploadReportService service;

  @Test
  void reportSuccessUpdatesStatusAndMetadata() throws Exception {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(true);
    when(objectMapper.writeValueAsString(org.mockito.ArgumentMatchers.anyMap())).thenReturn("{\"ok\":true}");

    CliRawResultUploadReportResponseData response = service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(
            "ssafer-cli",
            "1.4.0",
            152,
            "sha256:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
        )
    );

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.status()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(response.resultCount()).isEqualTo(152);
    assertThat(scan.getRawResultJson()).isEqualTo("{\"ok\":true}");
  }

  @Test
  void reportWithInvalidPayloadHashThrowsInvalidPayloadHash() {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, "sha256:abc123")
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PAYLOAD_HASH);
  }

  @Test
  void reportWhenAlreadyReportedThrowsDuplicate() {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(null, null, null, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
  }

  @ParameterizedTest
  @EnumSource(value = ScanStatus.class, names = {"RAW_UPLOADED", "QUEUED", "RUNNING", "DONE"})
  void reportWhenStatusIsAlreadyAcceptedFlowThrowsDuplicate(ScanStatus status) {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(null, null, null, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
  }

  @ParameterizedTest
  @EnumSource(value = ScanStatus.class, names = {"FAILED", "CANCELED"})
  void reportWhenStatusIsNotAcceptableThrowsConflict(ScanStatus status) {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest(null, null, null, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_STATUS_CONFLICT);
  }

  @Test
  void reportWhenRawResultObjectMissingThrowsNotFound() throws Exception {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    when(rawResultObjectVerifier.exists(scan.getRawResultPath())).thenReturn(false);

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.RAW_RESULT_NOT_FOUND);
  }

  @Test
  void reportWhenActorHasNoProjectPermissionThrowsForbidden() {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(999L));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(999L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void reportWhenProjectIsInactiveOrMissingThrowsNotFound() {
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(LocalDateTime.now().minusMinutes(1))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(1))
        .build();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.NOT_FOUND))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, AuthenticatedActor.member(1L));

    assertThatThrownBy(() -> service.report(
        1001L,
        AuthenticatedActor.member(1L),
        new CliRawResultUploadReportRequest("ssafer-cli", "1.4.0", 1, null)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }
}
