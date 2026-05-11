package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
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
  private ProjectRepository projectRepository;
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
    // 기존 프로젝트가 있으면 재사용하고 REQUESTED 생성 후 processor 결과를 그대로 반환한다.
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project project = new Project(10L, null, "Project A", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(project, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectRepository.findByUserIdAndDeletedAtIsNull(10L)).thenReturn(List.of(project));
    when(scanExecutionPermit.tryAcquire()).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"scanName\":\"scan-1\"}");
    when(scanRepository.save(any(Scan.class))).thenAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 3001L);
      return scan;
    });
    when(webUploadScanProcessor.process(any())).thenReturn(UploadScanProcessingResult.queued());

    UploadScanResult result = uploadScanService.requestUploadScan("  project   a  ", "scan-1", List.of(file));

    assertThat(result.scanId()).isEqualTo(3001L);
    assertThat(result.status()).isEqualTo(ScanStatus.QUEUED);
    assertThat(result.failureReason()).isNull();
    assertThat(result.errorCode()).isNull();

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    verify(scanRepository).save(scanCaptor.capture());
    Scan saved = scanCaptor.getValue();
    // Scan 엔티티가 업로드 모드(UPLOAD/REQUESTED)로 생성되는지 검증한다.
    assertThat(saved.getProjectId()).isEqualTo(2001L);
    assertThat(saved.getRequestedByUserId()).isEqualTo(10L);
    assertThat(saved.getScanMode()).isEqualTo(com.ssafer.scan.domain.enums.ScanMode.UPLOAD);
    assertThat(saved.getStatus()).isEqualTo(ScanStatus.REQUESTED);
    ArgumentCaptor<UploadScanProcessingCommand> commandCaptor = ArgumentCaptor.forClass(UploadScanProcessingCommand.class);
    verify(webUploadScanProcessor).process(commandCaptor.capture());
    // scan_result.json 생성을 위해 프로젝트 이름이 processor command에 전달되어야 한다.
    assertThat(commandCaptor.getValue().projectName()).isEqualTo("Project A");
    verify(projectRepository, never()).save(any(Project.class));
    verify(scanExecutionPermit).release();
  }

  @Test
  void requestUploadScanWhenProjectMissingCreatesNewProject() {
    // 동일 이름 프로젝트가 없으면 새 프로젝트를 생성한 뒤 업로드를 진행한다.
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    Project createdProject = new Project(10L, null, "Project A", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(createdProject, "id", 2001L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectRepository.findByUserIdAndDeletedAtIsNull(10L)).thenReturn(List.of());
    when(projectRepository.save(any(Project.class))).thenReturn(createdProject);
    when(scanExecutionPermit.tryAcquire()).thenReturn(true);
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"scanName\":\"scan-1\"}");
    when(scanRepository.save(any(Scan.class))).thenAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 3001L);
      return scan;
    });
    when(webUploadScanProcessor.process(any())).thenReturn(UploadScanProcessingResult.queued());

    UploadScanResult result = uploadScanService.requestUploadScan("  Project A  ", "scan-1", List.of(file));

    assertThat(result.scanId()).isEqualTo(3001L);
    ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
    verify(projectRepository).save(projectCaptor.capture());
    assertThat(projectCaptor.getValue().getName()).isEqualTo("Project A");
    ArgumentCaptor<UploadScanProcessingCommand> commandCaptor = ArgumentCaptor.forClass(UploadScanProcessingCommand.class);
    verify(webUploadScanProcessor).process(commandCaptor.capture());
    assertThat(commandCaptor.getValue().projectName()).isEqualTo("Project A");
  }

  @Test
  void requestUploadScanWhenPermitBusyThrowsBusyError() {
    // permit 획득 실패 시 Scan 생성 없이 즉시 BUSY 에러를 반환해야 한다.
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
    when(scanExecutionPermit.tryAcquire()).thenReturn(false);

    assertThatThrownBy(() -> uploadScanService.requestUploadScan("project-a", "scan-1", List.of(file)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_EXECUTION_BUSY);

    verify(projectRepository, never()).findByUserIdAndDeletedAtIsNull(any());
    verify(projectRepository, never()).save(any());
    verify(scanRepository, never()).save(any());
    verify(webUploadScanProcessor, never()).process(any());
    verify(scanExecutionPermit, never()).release();
  }

  @Test
  void requestUploadScanWhenValidationFailsSkipsPermitAcquire() {
    // 파일 검증에서 실패하면 permit 획득/Scan 생성/processor 호출을 모두 건너뛴다.
    AuthenticatedActor actor = AuthenticatedActor.member(10L);
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    doThrow(new BusinessException(ErrorCode.INVALID_PARAMETER))
        .when(uploadScanFileValidator)
        .validate(eq(List.of(file)));

    assertThatThrownBy(() -> uploadScanService.requestUploadScan("project-a", "scan-1", List.of(file)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);

    verify(projectRepository, never()).findByUserIdAndDeletedAtIsNull(any());
    verify(projectRepository, never()).save(any());
    verify(scanExecutionPermit, never()).tryAcquire();
    verify(scanRepository, never()).save(any());
    verify(webUploadScanProcessor, never()).process(any());
  }

  @Test
  void requestUploadScanWhenProcessingFailsAfterCreationReturnsFailurePayload() {
    // Scan 생성 이후 단계에서 실패하면 scanId를 포함한 실패 payload를 반환한다.
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
    when(projectRepository.findByUserIdAndDeletedAtIsNull(10L)).thenReturn(List.of(project));
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

    UploadScanResult result = uploadScanService.requestUploadScan("project-a", "scan-1", List.of(file));

    assertThat(result.scanId()).isEqualTo(3001L);
    assertThat(result.status()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(scanExecutionPermit).release();
  }
}
