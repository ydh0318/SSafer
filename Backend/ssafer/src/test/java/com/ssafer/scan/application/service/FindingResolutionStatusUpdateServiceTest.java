package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.FindingResolutionStatusUpdateResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FindingResolutionStatusUpdateServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private ScanFindingRepository scanFindingRepository;
  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private FindingResolutionStatusUpdateService findingResolutionStatusUpdateService;

  @Test
  void updateStatusChangesFindingResolutionStatus() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.OPEN);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanFindingRepository.findByIdForUpdate(finding.getId())).thenReturn(Optional.of(finding));
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(project.getId(), actor)).thenReturn(project);

    FindingResolutionStatusUpdateResponseData result = findingResolutionStatusUpdateService.updateStatus(
        finding.getId(),
        ResolutionStatus.RESOLVED,
        "  운영 설정에서 수동 조치 완료 확인  "
    );

    assertThat(result.findingId()).isEqualTo(finding.getId());
    assertThat(result.scanId()).isEqualTo(scan.getId());
    assertThat(result.previousStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(result.resolutionStatus()).isEqualTo(ResolutionStatus.RESOLVED);
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.RESOLVED);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(project.getId(), actor);
  }

  @Test
  void updateStatusAllowsAllResolutionStatuses() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(101L);
    Scan scan = scan(project.getId());
    ScanFinding finding = finding(scan.getId(), ResolutionStatus.RESOLVED);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanFindingRepository.findByIdForUpdate(finding.getId())).thenReturn(Optional.of(finding));
    when(scanRepository.findByIdAndDeletedAtIsNull(scan.getId())).thenReturn(Optional.of(scan));
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(project.getId(), actor)).thenReturn(project);

    FindingResolutionStatusUpdateResponseData result = findingResolutionStatusUpdateService.updateStatus(
        finding.getId(),
        ResolutionStatus.OPEN,
        null
    );

    assertThat(result.previousStatus()).isEqualTo(ResolutionStatus.RESOLVED);
    assertThat(result.resolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
  }

  @Test
  void updateStatusWhenFindingMissingThrowsNotFound() {
    when(scanFindingRepository.findByIdForUpdate(2001L)).thenReturn(Optional.empty());
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));

    assertThatThrownBy(() -> findingResolutionStatusUpdateService.updateStatus(
        2001L,
        ResolutionStatus.IGNORED,
        null
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);

    verify(scanRepository, never()).findByIdAndDeletedAtIsNull(1001L);
  }

  @Test
  void updateStatusWhenScanDeletedThrowsNotFound() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    ScanFinding finding = finding(1001L, ResolutionStatus.OPEN);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanFindingRepository.findByIdForUpdate(finding.getId())).thenReturn(Optional.of(finding));
    when(scanRepository.findByIdAndDeletedAtIsNull(finding.getScanId())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> findingResolutionStatusUpdateService.updateStatus(
        finding.getId(),
        ResolutionStatus.IGNORED,
        null
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);

    verify(projectAuthorizationService, never()).loadAuthorizedProjectOrThrow(101L, actor);
    assertThat(finding.getResolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
  }

  @Test
  void updateStatusWhenReasonTooLongAfterTrimThrowsInvalidParameter() {
    assertThatThrownBy(() -> findingResolutionStatusUpdateService.updateStatus(
        2001L,
        ResolutionStatus.RESOLVED,
        " " + "a".repeat(1001) + " "
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);

    verify(currentActorProvider, never()).getCurrentActor();
  }

  private Project project(Long projectId) {
    Project project = new Project(1L, null, "project", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Scan scan(Long projectId) {
    return Scan.builder()
        .id(1001L)
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 5, 19, 10, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 19, 10, 5))
        .build();
  }

  private ScanFinding finding(Long scanId, ResolutionStatus resolutionStatus) {
    return ScanFinding.builder()
        .id(2001L)
        .scanId(scanId)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("FND-0001")
        .severity(Severity.HIGH)
        .category("CONFIG")
        .title("Image user should not be 'root'")
        .resolutionStatus(resolutionStatus)
        .createdAt(LocalDateTime.of(2026, 5, 19, 10, 1))
        .build();
  }
}
