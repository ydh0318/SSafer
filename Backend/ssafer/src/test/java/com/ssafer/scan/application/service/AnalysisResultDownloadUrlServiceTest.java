package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.AnalysisResultDownloadUrlResponseData;
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

@ExtendWith(MockitoExtension.class)
class AnalysisResultDownloadUrlServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @Mock
  private AnalysisResultDownloadUrlIssuer analysisResultDownloadUrlIssuer;

  @InjectMocks
  private AnalysisResultDownloadUrlService analysisResultDownloadUrlService;

  @Test
  void issueDownloadUrlReturnsPresignedUrlForDoneScan() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = createScan(1001L, ScanStatus.DONE, "s3://ssafer/analysis/1001/analysis_result.json");
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(analysisResultDownloadUrlIssuer.issueGetUrl("s3://ssafer/analysis/1001/analysis_result.json"))
        .thenReturn(new AnalysisResultDownloadUrl("https://presigned-url.example.com/download", 600));

    AnalysisResultDownloadUrlResponseData response = analysisResultDownloadUrlService.issueDownloadUrl(1001L);

    assertThat(response.analysisResultPath()).isEqualTo("s3://ssafer/analysis/1001/analysis_result.json");
    assertThat(response.downloadUrl()).isEqualTo("https://presigned-url.example.com/download");
    assertThat(response.expiresInSeconds()).isEqualTo(600);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void issueDownloadUrlWhenScanMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertBusinessException(() -> analysisResultDownloadUrlService.issueDownloadUrl(999L), ErrorCode.NOT_FOUND);
    verify(analysisResultDownloadUrlIssuer, never()).issueGetUrl(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void issueDownloadUrlWhenScanDeletedThrowsNotFound() {
    Scan scan = createScan(1001L, ScanStatus.DONE, "s3://ssafer/analysis/1001/analysis_result.json");
    scan.softDelete();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));

    assertBusinessException(() -> analysisResultDownloadUrlService.issueDownloadUrl(1001L), ErrorCode.NOT_FOUND);
    verify(analysisResultDownloadUrlIssuer, never()).issueGetUrl(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void issueDownloadUrlWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = createScan(1001L, ScanStatus.DONE, "s3://ssafer/analysis/1001/analysis_result.json");
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertBusinessException(() -> analysisResultDownloadUrlService.issueDownloadUrl(1001L), ErrorCode.FORBIDDEN);
    verify(analysisResultDownloadUrlIssuer, never()).issueGetUrl(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void issueDownloadUrlWhenScanIsNotDoneThrowsScanStatusConflict() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = createScan(1001L, ScanStatus.RUNNING, "s3://ssafer/analysis/1001/analysis_result.json");
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));

    assertBusinessException(() -> analysisResultDownloadUrlService.issueDownloadUrl(1001L), ErrorCode.SCAN_STATUS_CONFLICT);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
    verify(analysisResultDownloadUrlIssuer, never()).issueGetUrl(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void issueDownloadUrlWhenAnalysisResultPathMissingThrowsAnalysisResultNotFound() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = createScan(1001L, ScanStatus.DONE, null);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));

    assertBusinessException(() -> analysisResultDownloadUrlService.issueDownloadUrl(1001L), ErrorCode.ANALYSIS_RESULT_NOT_FOUND);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
    verify(analysisResultDownloadUrlIssuer, never()).issueGetUrl(org.mockito.ArgumentMatchers.anyString());
  }

  private static void assertBusinessException(Runnable action, ErrorCode expectedErrorCode) {
    assertThatThrownBy(action::run)
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(expectedErrorCode);
  }

  private static Scan createScan(Long scanId, ScanStatus status, String analysisResultPath) {
    return Scan.builder()
        .id(scanId)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .analysisResultPath(analysisResultPath)
        .requestedAt(LocalDateTime.of(2026, 5, 11, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 9, 3))
        .build();
  }
}
