package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class UploadScanServiceTest {

  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;
  @Mock
  private UploadScanFileValidator uploadScanFileValidator;
  @Mock
  private ScanExecutionPermit scanExecutionPermit;
  @Mock
  private ScanRepository scanRepository;
  @Mock
  private WebUploadScanProcessor webUploadScanProcessor;
  @Mock
  private ObjectMapper objectMapper;

  @InjectMocks
  private UploadScanService uploadScanService;

  @Test
  void requestUploadScanCreatesRequestedScanAndReturnsQueued() {
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project project = new Project(10L, null, "project-a", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(2001L, actor)).thenReturn(project);
    when(scanExecutionPermit.tryAcquire()).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"scanName\":\"scan-1\"}");
    when(scanRepository.save(any(Scan.class))).thenAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 3001L);
      return scan;
    });
    when(webUploadScanProcessor.process(any())).thenReturn(UploadScanProcessingResult.queued());

    UploadScanResult result = uploadScanService.requestUploadScan(2001L, "scan-1", List.of(file));

    assertThat(result.scanId()).isEqualTo(3001L);
    assertThat(result.status()).isEqualTo(ScanStatus.QUEUED);
    assertThat(result.failureReason()).isNull();
    assertThat(result.errorCode()).isNull();

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    verify(scanRepository).save(scanCaptor.capture());
    Scan saved = scanCaptor.getValue();
    assertThat(saved.getProjectId()).isEqualTo(2001L);
    assertThat(saved.getRequestedByUserId()).isEqualTo(10L);
    assertThat(saved.getScanMode()).isEqualTo(com.ssafer.scan.domain.enums.ScanMode.UPLOAD);
    assertThat(saved.getStatus()).isEqualTo(ScanStatus.REQUESTED);
    verify(scanExecutionPermit).release();
  }

  @Test
  void requestUploadScanWhenPermitBusyThrowsBusyError() {
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project project = new Project(10L, null, "project-a", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(2001L, actor)).thenReturn(project);
    when(scanExecutionPermit.tryAcquire()).thenReturn(false);

    assertThatThrownBy(() -> uploadScanService.requestUploadScan(2001L, "scan-1", List.of(file)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_EXECUTION_BUSY);

    verify(scanRepository, never()).save(any());
    verify(webUploadScanProcessor, never()).process(any());
    verify(scanExecutionPermit, never()).release();
  }

  @Test
  void requestUploadScanWhenValidationFailsSkipsPermitAcquire() {
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project project = new Project(10L, null, "project-a", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(2001L, actor)).thenReturn(project);
    org.mockito.Mockito.doThrow(new BusinessException(ErrorCode.INVALID_PARAMETER))
        .when(uploadScanFileValidator)
        .validate(eq(List.of(file)));

    assertThatThrownBy(() -> uploadScanService.requestUploadScan(2001L, "scan-1", List.of(file)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);

    verify(scanExecutionPermit, never()).tryAcquire();
    verify(scanRepository, never()).save(any());
    verify(webUploadScanProcessor, never()).process(any());
  }

  @Test
  void requestUploadScanWhenProcessingFailsAfterCreationReturnsFailurePayload() {
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project project = new Project(10L, null, "project-a", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(2001L, actor)).thenReturn(project);
    when(scanExecutionPermit.tryAcquire()).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"scanName\":\"scan-1\"}");
    when(scanRepository.save(any(Scan.class))).thenAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 3001L);
      return scan;
    });
    when(webUploadScanProcessor.process(any())).thenReturn(
        UploadScanProcessingResult.rawUploadedFailed(
            ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED,
            ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED
        )
    );

    UploadScanResult result = uploadScanService.requestUploadScan(2001L, "scan-1", List.of(file));

    assertThat(result.scanId()).isEqualTo(3001L);
    assertThat(result.status()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(scanExecutionPermit).release();
  }
}
