package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ScanSummaryQueryServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private ScanFindingRepository scanFindingRepository;

  @Mock
  private ScanNodeRepository scanNodeRepository;

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private ScanSummaryQueryService scanSummaryQueryService;

  @Test
  void getScanSummaryReturnsAggregatedResponse() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 23, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 23, 9, 3))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.countByScanId(1001L)).thenReturn(12L);
    when(scanNodeRepository.countByScanId(1001L)).thenReturn(3L);
    when(scanFindingRepository.countSeverityByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{Severity.CRITICAL, 1L},
        new Object[]{Severity.HIGH, 2L},
        new Object[]{Severity.MEDIUM, 4L},
        new Object[]{Severity.LOW, 3L},
        new Object[]{Severity.INFO, 2L}
    ));
    when(scanFindingRepository.countCategoryByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{"CONFIG", 2L},
        new Object[]{"SECRET", 1L}
    ));
    when(scanFindingRepository.countSourceTypeByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{"TRIVY", 2L},
        new Object[]{"CUSTOM_RULE", 1L}
    ));
    when(scanFindingRepository.countResolutionStatusByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{"OPEN", 3L}
    ));

    ScanSummaryResponse response = scanSummaryQueryService.getScanSummary(1001L);

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.projectId()).isEqualTo(101L);
    assertThat(response.totalFindings()).isEqualTo(12L);
    assertThat(response.nodeCount()).isEqualTo(3L);
    assertThat(response.criticalCount()).isEqualTo(1L);
    assertThat(response.highCount()).isEqualTo(2L);
    assertThat(response.mediumCount()).isEqualTo(4L);
    assertThat(response.lowCount()).isEqualTo(3L);
    assertThat(response.infoCount()).isEqualTo(2L);
    assertThat(response.categoryCounts()).containsEntry("CONFIG", 2L).containsEntry("SECRET", 1L);
    assertThat(response.sourceCounts()).containsEntry("TRIVY", 2L).containsEntry("CUSTOM_RULE", 1L);
    assertThat(response.resolutionCounts()).containsEntry("OPEN", 3L);
  }

  @Test
  @DisplayName("summary 집계에서 null/blank group key는 응답에 노출하지 않는다")
  void getScanSummarySkipsNullOrBlankGroupKeys() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 23, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 23, 9, 3))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.countByScanId(1001L)).thenReturn(2L);
    when(scanNodeRepository.countByScanId(1001L)).thenReturn(1L);
    when(scanFindingRepository.countSeverityByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{null, 99L},
        new Object[]{Severity.CRITICAL, 1L}
    ));
    when(scanFindingRepository.countCategoryByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{null, 5L},
        new Object[]{"   ", 4L},
        new Object[]{"CONFIG", 2L}
    ));
    when(scanFindingRepository.countSourceTypeByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{null, 5L},
        new Object[]{"TRIVY", 2L}
    ));
    when(scanFindingRepository.countResolutionStatusByScanId(1001L)).thenReturn(List.<Object[]>of(
        new Object[]{null, 5L},
        new Object[]{"OPEN", 2L}
    ));

    ScanSummaryResponse response = scanSummaryQueryService.getScanSummary(1001L);

    assertThat(response.criticalCount()).isEqualTo(1L);
    assertThat(response.categoryCounts()).containsOnlyKeys("CONFIG");
    assertThat(response.sourceCounts()).containsOnlyKeys("TRIVY");
    assertThat(response.resolutionCounts()).containsOnlyKeys("OPEN");
  }

  @Test
  void getScanSummaryWhenMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanSummaryQueryService.getScanSummary(999L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanSummaryWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 23, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 23, 9, 3))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> scanSummaryQueryService.getScanSummary(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }
}
