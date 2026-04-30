package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

class HistoryScanQueryServiceTest {

  private ScanRepository scanRepository;
  private ScanFindingRepository scanFindingRepository;
  private CurrentActorProvider currentActorProvider;
  private ProjectAuthorizationService projectAuthorizationService;
  private HistoryScanQueryService historyScanQueryService;

  @BeforeEach
  void setUp() {
    scanRepository = Mockito.mock(ScanRepository.class);
    scanFindingRepository = Mockito.mock(ScanFindingRepository.class);
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    historyScanQueryService = new HistoryScanQueryService(
        scanRepository,
        scanFindingRepository,
        currentActorProvider,
        projectAuthorizationService
    );
  }

  @Test
  void getCurrentUserScanHistoryReturnsPagedResponseWithFilteredSummary() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project101 = createProject(101L, 1L, "alpha");
    Project project102 = createProject(102L, 1L, "beta");

    Scan pagedScan = createScan(1002L, 102L, ScanStatus.RUNNING, ScanMode.AGENT);

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(projectAuthorizationService.loadAuthorizedProjects(actor)).willReturn(List.of(project101, project102));
    given(scanRepository.findAll(any(Specification.class), any(Pageable.class)))
        .willReturn(new PageImpl<>(
            List.of(pagedScan),
            PageRequest.of(0, 1),
            2
        ));
    given(scanFindingRepository.countSeverityByScanIds(List.of(1002L)))
        .willReturn(List.of(
            new Object[]{1002L, Severity.CRITICAL, 1L},
            new Object[]{1002L, Severity.HIGH, 2L},
            new Object[]{1002L, Severity.LOW, 2L}
        ));
    given(scanFindingRepository.countSeveritySummaryForHistory(List.of(101L, 102L), null, null))
        .willReturn(List.of(
            new Object[]{Severity.CRITICAL, 1L},
            new Object[]{Severity.HIGH, 5L},
            new Object[]{Severity.MEDIUM, 5L},
            new Object[]{Severity.LOW, 6L}
        ));

    HistoryScanListResponse result = historyScanQueryService.getCurrentUserScanHistory(0, 1, null, null, null);

    assertThat(result.page()).isEqualTo(0);
    assertThat(result.size()).isEqualTo(1);
    assertThat(result.totalElements()).isEqualTo(2L);
    assertThat(result.totalPages()).isEqualTo(2);

    assertThat(result.summary().totalScanCount()).isEqualTo(2L);
    assertThat(result.summary().totalFindingCount()).isEqualTo(17L);
    assertThat(result.summary().criticalCount()).isEqualTo(1L);
    assertThat(result.summary().highCount()).isEqualTo(5L);
    assertThat(result.summary().mediumCount()).isEqualTo(5L);
    assertThat(result.summary().lowCount()).isEqualTo(6L);
    assertThat(result.summary().infoCount()).isEqualTo(0L);

    assertThat(result.items()).hasSize(1);
    assertThat(result.items().get(0).scanId()).isEqualTo(1002L);
    assertThat(result.items().get(0).projectId()).isEqualTo(102L);
    assertThat(result.items().get(0).totalFindingCount()).isEqualTo(5L);
    assertThat(result.items().get(0).criticalCount()).isEqualTo(1L);
    assertThat(result.items().get(0).highCount()).isEqualTo(2L);
  }

  @Test
  void getCurrentUserScanHistoryWhenProjectFilterExistsValidatesAuthorization() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = createProject(101L, 1L, "alpha");

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(101L, actor)).willReturn(project);
    given(scanRepository.findAll(any(Specification.class), any(Pageable.class)))
        .willReturn(Page.empty(PageRequest.of(0, 20)));

    HistoryScanListResponse result = historyScanQueryService.getCurrentUserScanHistory(0, 20, 101L, ScanStatus.DONE, null);

    assertThat(result.totalElements()).isZero();
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
    verify(scanFindingRepository, never()).countSeveritySummaryForHistory(any(), any(), any());
  }

  @Test
  void getCurrentUserScanHistoryWhenPageInvalidThrowsInvalidParameter() {
    given(currentActorProvider.getCurrentActor()).willReturn(AuthenticatedActor.member(1L));

    assertThatThrownBy(() -> historyScanQueryService.getCurrentUserScanHistory(-1, 20, null, null, null))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void getCurrentUserScanHistoryThrowsForbiddenForGuest() {
    given(currentActorProvider.getCurrentActor()).willReturn(AuthenticatedActor.guest("guest-hash"));

    assertThatThrownBy(() -> historyScanQueryService.getCurrentUserScanHistory(0, 20, null, null, null))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void getCurrentUserScanHistoryWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(eq(999L), eq(actor));

    assertThatThrownBy(() -> historyScanQueryService.getCurrentUserScanHistory(0, 20, 999L, null, null))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  private Project createProject(Long id, Long userId, String name) {
    Project project = new Project(userId, null, name, null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    try {
      java.lang.reflect.Field idField = Project.class.getDeclaredField("id");
      idField.setAccessible(true);
      idField.set(project, id);

      java.lang.reflect.Field createdAtField = Project.class.getDeclaredField("createdAt");
      createdAtField.setAccessible(true);
      createdAtField.set(project, Instant.now());

      java.lang.reflect.Field updatedAtField = Project.class.getDeclaredField("updatedAt");
      updatedAtField.setAccessible(true);
      updatedAtField.set(project, Instant.now());
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    return project;
  }

  private Scan createScan(Long scanId, Long projectId, ScanStatus status, ScanMode scanMode) {
    return Scan.builder()
        .id(scanId)
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(scanMode)
        .status(status)
        .requestedAt(LocalDateTime.of(2026, 4, 30, 10, 0))
        .completedAt(LocalDateTime.of(2026, 4, 30, 10, 10))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 30, 10, 10))
        .build();
  }
}
