package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.FindingOpenSummaryResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FindingOpenSummaryQueryServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private ScanFindingRepository scanFindingRepository;
  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private FindingOpenSummaryQueryService findingOpenSummaryQueryService;

  @Test
  void getOpenSummaryForWorkspaceAggregatesLatestDoneScanPerProject() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project101 = project(101L);
    Project project102 = project(102L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjects(actor)).thenReturn(List.of(project101, project102));
    when(scanRepository.findLatestScansByProjectIdsAndStatus(
        List.of(101L, 102L),
        ScanStatus.DONE
    )).thenReturn(List.of(
        scan(1002L, 101L, LocalDateTime.of(2026, 5, 19, 11, 0)),
        scan(1001L, 101L, LocalDateTime.of(2026, 5, 19, 10, 0)),
        scan(2001L, 102L, LocalDateTime.of(2026, 5, 19, 9, 0))
    ));
    when(scanFindingRepository.countSeverityByScanIdsAndResolutionStatuses(
        List.of(1002L, 2001L),
        List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
    )).thenReturn(List.of(
        row(Severity.HIGH, 2L),
        row(Severity.LOW, 1L)
    ));

    FindingOpenSummaryResponseData result = findingOpenSummaryQueryService.getOpenSummary(null);

    assertThat(result.scope().type()).isEqualTo("WORKSPACE");
    assertThat(result.scope().projectId()).isNull();
    assertThat(result.openCount()).isEqualTo(3L);
    assertThat(result.bySeverity()).containsEntry(Severity.CRITICAL, 0L);
    assertThat(result.bySeverity()).containsEntry(Severity.HIGH, 2L);
    assertThat(result.bySeverity()).containsEntry(Severity.MEDIUM, 0L);
    assertThat(result.bySeverity()).containsEntry(Severity.LOW, 1L);
    assertThat(result.bySeverity()).containsEntry(Severity.INFO, 0L);
    assertThat(result.includedStatuses()).containsExactly(
        ResolutionStatus.OPEN,
        ResolutionStatus.IN_PROGRESS
    );
  }

  @Test
  void getOpenSummaryForProjectChecksAuthorizationAndAggregatesProjectScope() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(123L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjectOrThrow(123L, actor)).thenReturn(project);
    when(scanRepository.findLatestScansByProjectIdsAndStatus(
        List.of(123L),
        ScanStatus.DONE
    )).thenReturn(List.of(scan(3001L, 123L, LocalDateTime.of(2026, 5, 19, 11, 0))));
    when(scanFindingRepository.countSeverityByScanIdsAndResolutionStatuses(
        List.of(3001L),
        List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
    )).thenReturn(List.<Object[]>of(row(Severity.MEDIUM, 4L)));

    FindingOpenSummaryResponseData result = findingOpenSummaryQueryService.getOpenSummary(123L);

    assertThat(result.scope().type()).isEqualTo("PROJECT");
    assertThat(result.scope().projectId()).isEqualTo(123L);
    assertThat(result.openCount()).isEqualTo(4L);
    assertThat(result.bySeverity()).containsEntry(Severity.MEDIUM, 4L);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(123L, actor);
  }

  @Test
  void getOpenSummaryWhenNoAuthorizedProjectsReturnsZero() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjects(actor)).thenReturn(List.of());

    FindingOpenSummaryResponseData result = findingOpenSummaryQueryService.getOpenSummary(null);

    assertThat(result.scope().type()).isEqualTo("WORKSPACE");
    assertThat(result.openCount()).isZero();
    assertThat(result.bySeverity().values()).containsOnly(0L);
    verify(scanRepository, never())
        .findLatestScansByProjectIdsAndStatus(
            List.of(),
            ScanStatus.DONE
        );
    verify(scanFindingRepository, never()).countSeverityByScanIdsAndResolutionStatuses(
        List.of(),
        List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
    );
  }

  @Test
  void getOpenSummaryWhenNoLatestDoneScansReturnsZero() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = project(101L);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(projectAuthorizationService.loadAuthorizedProjects(actor)).thenReturn(List.of(project));
    when(scanRepository.findLatestScansByProjectIdsAndStatus(
        List.of(101L),
        ScanStatus.DONE
    )).thenReturn(List.of());

    FindingOpenSummaryResponseData result = findingOpenSummaryQueryService.getOpenSummary(null);

    assertThat(result.openCount()).isZero();
    assertThat(result.bySeverity().values()).containsOnly(0L);
    verify(scanFindingRepository, never()).countSeverityByScanIdsAndResolutionStatuses(
        List.of(),
        List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
    );
  }

  private Project project(Long projectId) {
    Project project = new Project(
        1L,
        null,
        "project",
        null,
        com.ssafer.project.domain.enums.ScanMode.AGENT,
        false
    );
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Scan scan(Long scanId, Long projectId, LocalDateTime completedAt) {
    return Scan.builder()
        .id(scanId)
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .requestedAt(completedAt.minusMinutes(10))
        .completedAt(completedAt)
        .lastUpdatedAt(completedAt)
        .build();
  }

  private Object[] row(Severity severity, long count) {
    return new Object[] {severity, count};
  }
}
