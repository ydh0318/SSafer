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
    // 같은 소유자 범위에서 정규화 이름이 같으면 기존 프로젝트를 재사용해야 한다.
    Project existing = new Project(1L, null, "sample app", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(existing, "id", 2001L);
    given(projectRepository.findByUserIdAndDeletedAtIsNull(1L)).willReturn(List.of(existing));
    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 1001L);
      return scan;
    });
    given(scanRepository.updateRawResultPath(1001L, "s3://ssafer/raw/1001/scan_result.json")).willReturn(1);
    given(rawUploadUrlIssuer.issuePutUrl("raw/1001/scan_result.json"))
        .willReturn("https://presigned-url.example.com/raw/1001/scan_result.json");

    ScanRegistrationResult result = scanRegistrationService.register(
        AuthenticatedActor.member(1L),
        new CreateScanRequest(" Sample   App ", ScanRequestSource.AGENT, "로컬 서버 점검", "/opt/app", false)
    );

    assertThat(result.scanId()).isEqualTo(1001L);
    assertThat(result.projectId()).isEqualTo(2001L);
    assertThat(result.status()).isEqualTo(ScanStatus.REQUESTED);
    assertThat(result.rawResultPath()).isEqualTo("s3://ssafer/raw/1001/scan_result.json");
    assertThat(result.rawUploadUrl()).isEqualTo("https://presigned-url.example.com/raw/1001/scan_result.json");
    then(projectRepository).should().findByUserIdAndDeletedAtIsNull(1L);
    then(projectRepository).shouldHaveNoMoreInteractions();

    ArgumentCaptor<Scan> scanCaptor = ArgumentCaptor.forClass(Scan.class);
    then(scanRepository).should().save(scanCaptor.capture());
    Scan saved = scanCaptor.getValue();
    assertThat(saved.getProjectId()).isEqualTo(2001L);
    assertThat(saved.getRequestActorType()).isEqualTo(RequestActorType.USER);
    assertThat(saved.getRequestedByUserId()).isEqualTo(1L);
    assertThat(saved.getStatus()).isEqualTo(ScanStatus.REQUESTED);

    Map<?, ?> snapshot = objectMapper.readValue(saved.getTargetSnapshotJson(), Map.class);
    assertThat(snapshot.get("source")).isEqualTo("AGENT");
    assertThat(snapshot.get("scanName")).isEqualTo("로컬 서버 점검");
    assertThat(snapshot.get("targetPath")).isEqualTo("/opt/app");
    assertThat(snapshot.get("includeLogs")).isEqualTo(false);

    then(scanRepository).should().updateRawResultPath(1001L, "s3://ssafer/raw/1001/scan_result.json");
    then(rawUploadUrlIssuer).should().issuePutUrl("raw/1001/scan_result.json");
  }

  @Test
  void registerCreatesProjectWhenNoGuestProjectMatches() {
    // 게스트 소유 범위에 매칭 프로젝트가 없으면 자동 생성 후 스캔을 등록해야 한다.
    given(projectRepository.findByGuestOwnerKeyHashAndDeletedAtIsNull("guest-hash")).willReturn(List.of());

    Project created = new Project(null, "guest-hash", "sample app", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(created, "id", 3001L);
    given(projectRepository.save(any(Project.class))).willReturn(created);

    given(scanRepository.save(any(Scan.class))).willAnswer(invocation -> {
      Scan scan = invocation.getArgument(0);
      ReflectionTestUtils.setField(scan, "id", 4001L);
      return scan;
    });
    given(scanRepository.updateRawResultPath(4001L, "s3://ssafer/raw/4001/scan_result.json")).willReturn(1);
    given(rawUploadUrlIssuer.issuePutUrl("raw/4001/scan_result.json"))
        .willReturn("https://presigned-url.example.com/raw/4001/scan_result.json");

    ScanRegistrationResult result = scanRegistrationService.register(
        AuthenticatedActor.guest("guest-hash"),
        new CreateScanRequest("  Sample   App ", ScanRequestSource.AGENT, null, null, null)
    );

    assertThat(result.projectId()).isEqualTo(3001L);
    assertThat(result.scanId()).isEqualTo(4001L);
    assertThat(result.rawResultPath()).isEqualTo("s3://ssafer/raw/4001/scan_result.json");
    assertThat(result.rawUploadUrl()).isEqualTo("https://presigned-url.example.com/raw/4001/scan_result.json");

    ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
    then(projectRepository).should().save(projectCaptor.capture());
    Project savedProject = projectCaptor.getValue();
    assertThat(savedProject.getGuestOwnerKeyHash()).isEqualTo("guest-hash");
    assertThat(savedProject.getUserId()).isNull();
    assertThat(savedProject.getName()).isEqualTo("sample app");

    then(scanRepository).should().updateRawResultPath(eq(4001L), eq("s3://ssafer/raw/4001/scan_result.json"));
    then(rawUploadUrlIssuer).should().issuePutUrl("raw/4001/scan_result.json");
  }
}
