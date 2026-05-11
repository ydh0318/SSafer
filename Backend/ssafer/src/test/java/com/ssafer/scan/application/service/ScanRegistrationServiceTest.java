package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.api.dto.CreateScanRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanRequestSource;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

class ScanRegistrationServiceTest {

  private ProjectRepository projectRepository;
  private ScanRepository scanRepository;
  private RawUploadUrlIssuer rawUploadUrlIssuer;
  private ScanRegistrationService scanRegistrationService;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    projectRepository = Mockito.mock(ProjectRepository.class);
    scanRepository = Mockito.mock(ScanRepository.class);
    rawUploadUrlIssuer = Mockito.mock(RawUploadUrlIssuer.class);
    objectMapper = new ObjectMapper();
    scanRegistrationService = new ScanRegistrationService(
        projectRepository,
        scanRepository,
        rawUploadUrlIssuer,
        objectMapper
    );
    ReflectionTestUtils.setField(scanRegistrationService, "rawResultBucket", "ssafer");
  }

  @Test
  void registerReusesExistingProjectForMember() throws Exception {
    Project existing = new Project(1L, null, "Sample App", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(existing, "id", 2001L);
    given(projectRepository.findByUserIdAndDeletedAtIsNull(1L)).willReturn(List.of(existing));
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 1001L);
      return scan;
    });
    given(scanRepository.updateRawResultPath(eq(1001L), any(String.class))).willReturn(1);
    given(rawUploadUrlIssuer.issuePutUrl(any(String.class)))
        .willReturn("https://presigned-url.example.com/upload");

    ScanRegistrationResult result = scanRegistrationService.register(
        AuthenticatedActor.member(1L),
        new CreateScanRequest(" Sample   App ", ScanRequestSource.AGENT, "local scan", "/opt/app", false, null)
    );

    assertThat(result.scanId()).isEqualTo(1001L);
    assertThat(result.projectId()).isEqualTo(2001L);
    assertThat(result.status()).isEqualTo(ScanStatus.REQUESTED);
    assertThat(result.rawResultPath()).startsWith("s3://ssafer/raw/1001/");
    assertThat(result.rawResultPath()).endsWith("/scan_result.json");
    assertThat(result.rawUploadUrl()).isEqualTo("https://presigned-url.example.com/upload");
    then(projectRepository).should().findByUserIdAndDeletedAtIsNull(1L);
    then(projectRepository).shouldHaveNoMoreInteractions();

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    then(scanRepository).should().save(scanCaptor.capture());
    Scan saved = scanCaptor.getValue();
    assertThat(saved.getProjectId()).isEqualTo(2001L);
    assertThat(saved.getRequestActorType()).isEqualTo(RequestActorType.USER);
    assertThat(saved.getRequestedByUserId()).isEqualTo(1L);
    assertThat(saved.getStatus()).isEqualTo(ScanStatus.REQUESTED);
    assertThat(saved.getScanType()).isEqualTo(ScanType.PROJECT_FILE);

    Map<?, ?> snapshot = objectMapper.readValue(saved.getTargetSnapshotJson(), Map.class);
    assertThat(snapshot.get("source")).isEqualTo("AGENT");
    assertThat(snapshot.get("scanType")).isEqualTo("PROJECT_FILE");
    assertThat(snapshot.get("scanName")).isEqualTo("local scan");
    assertThat(snapshot.get("targetPath")).isEqualTo("/opt/app");
    assertThat(snapshot.get("includeLogs")).isEqualTo(false);

    ArgumentCaptor<String> pathCaptor = ArgumentCaptor.forClass(String.class);
    then(scanRepository).should().updateRawResultPath(eq(1001L), pathCaptor.capture());
    assertThat(pathCaptor.getValue()).startsWith("s3://ssafer/raw/1001/");
    assertThat(pathCaptor.getValue()).endsWith("/scan_result.json");

    ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
    then(rawUploadUrlIssuer).should().issuePutUrl(keyCaptor.capture());
    assertThat(keyCaptor.getValue()).startsWith("raw/1001/");
    assertThat(keyCaptor.getValue()).endsWith("/scan_result.json");
  }

  @Test
  void registerCreatesProjectWhenNoGuestProjectMatches() {
    given(projectRepository.findByGuestOwnerKeyHashAndDeletedAtIsNull("guest-hash")).willReturn(List.of());

    Project created = new Project(null, "guest-hash", "Sample App", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(created, "id", 3001L);
    given(projectRepository.save(any(Project.class))).willReturn(created);

    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 4001L);
      return scan;
    });
    given(scanRepository.updateRawResultPath(eq(4001L), any(String.class))).willReturn(1);
    given(rawUploadUrlIssuer.issuePutUrl(any(String.class)))
        .willReturn("https://presigned-url.example.com/upload");

    ScanRegistrationResult result = scanRegistrationService.register(
        AuthenticatedActor.guest("guest-hash"),
        new CreateScanRequest("  Sample   App ", ScanRequestSource.AGENT, null, null, null, null)
    );

    assertThat(result.projectId()).isEqualTo(3001L);
    assertThat(result.scanId()).isEqualTo(4001L);
    assertThat(result.rawResultPath()).startsWith("s3://ssafer/raw/4001/");
    assertThat(result.rawResultPath()).endsWith("/scan_result.json");
    assertThat(result.rawUploadUrl()).isEqualTo("https://presigned-url.example.com/upload");

    ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
    then(projectRepository).should().save(projectCaptor.capture());
    Project savedProject = projectCaptor.getValue();
    assertThat(savedProject.getGuestOwnerKeyHash()).isEqualTo("guest-hash");
    assertThat(savedProject.getUserId()).isNull();
    assertThat(savedProject.getName()).isEqualTo("Sample   App");

    ArgumentCaptor<String> guestPathCaptor = ArgumentCaptor.forClass(String.class);
    then(scanRepository).should().updateRawResultPath(eq(4001L), guestPathCaptor.capture());
    assertThat(guestPathCaptor.getValue()).startsWith("s3://ssafer/raw/4001/");
    assertThat(guestPathCaptor.getValue()).endsWith("/scan_result.json");

    ArgumentCaptor<String> guestKeyCaptor = ArgumentCaptor.forClass(String.class);
    then(rawUploadUrlIssuer).should().issuePutUrl(guestKeyCaptor.capture());
    assertThat(guestKeyCaptor.getValue()).startsWith("raw/4001/");
    assertThat(guestKeyCaptor.getValue()).endsWith("/scan_result.json");
  }

  @Test
  void registerStoresServerAuditScanType() throws Exception {
    given(projectRepository.findByUserIdAndDeletedAtIsNull(1L)).willReturn(List.of());

    Project created = new Project(1L, null, "Server Audit", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(created, "id", 5001L);
    given(projectRepository.save(any(Project.class))).willReturn(created);
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 6001L);
      return scan;
    });
    given(scanRepository.updateRawResultPath(eq(6001L), any(String.class))).willReturn(1);
    given(rawUploadUrlIssuer.issuePutUrl(any(String.class)))
        .willReturn("https://presigned-url.example.com/upload");

    ScanRegistrationResult result = scanRegistrationService.register(
        AuthenticatedActor.member(1L),
        new CreateScanRequest("Server Audit", ScanRequestSource.CLI, "server-audit", "/var/log", true, ScanType.SERVER_AUDIT)
    );

    assertThat(result.scanId()).isEqualTo(6001L);
    assertThat(result.rawResultPath()).startsWith("s3://ssafer/raw/6001/");

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    then(scanRepository).should().save(scanCaptor.capture());
    assertThat(scanCaptor.getValue().getScanType()).isEqualTo(ScanType.SERVER_AUDIT);
    Map<?, ?> snapshot = objectMapper.readValue(scanCaptor.getValue().getTargetSnapshotJson(), Map.class);
    assertThat(snapshot.get("scanType")).isEqualTo("SERVER_AUDIT");
  }
}
