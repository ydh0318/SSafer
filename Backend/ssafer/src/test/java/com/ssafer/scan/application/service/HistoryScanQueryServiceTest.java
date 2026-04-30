package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class HistoryScanQueryServiceTest {

  private ScanRepository scanRepository;
  private ScanFindingRepository scanFindingRepository;
  private CurrentActorProvider currentActorProvider;
  private HistoryScanQueryService historyScanQueryService;

  @BeforeEach
  void setUp() {
    scanRepository = Mockito.mock(ScanRepository.class);
    scanFindingRepository = Mockito.mock(ScanFindingRepository.class);
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    historyScanQueryService = new HistoryScanQueryService(
        scanRepository,
        scanFindingRepository,
        currentActorProvider
    );
  }

  @Test
  void getCurrentUserScanHistoryReturnsCurrentMemberScansWithSeveritySummaryCounts() {
    given(currentActorProvider.getCurrentActor()).willReturn(AuthenticatedActor.member(1L));
    given(scanRepository.findByRequestedByUserIdOrderByRequestedAtDescIdDesc(1L))
        .willReturn(List.of(
            createScan(1002L, 102L, ScanStatus.RUNNING, ScanMode.AGENT),
            createScan(1001L, 101L, ScanStatus.DONE, ScanMode.UPLOAD)
        ));
    given(scanFindingRepository.countSeverityByScanIds(List.of(1002L, 1001L)))
        .willReturn(List.of(
            new Object[]{1002L, Severity.CRITICAL, 1L},
            new Object[]{1002L, Severity.HIGH, 2L},
            new Object[]{1002L, Severity.LOW, 2L},
            new Object[]{1001L, Severity.HIGH, 3L},
            new Object[]{1001L, Severity.MEDIUM, 5L},
            new Object[]{1001L, Severity.LOW, 4L}
        ));

    HistoryScanListResponse result = historyScanQueryService.getCurrentUserScanHistory();

    assertThat(result.summary().totalScanCount()).isEqualTo(2L);
    assertThat(result.summary().totalFindingCount()).isEqualTo(17L);
    assertThat(result.summary().criticalCount()).isEqualTo(1L);
    assertThat(result.summary().highCount()).isEqualTo(5L);
    assertThat(result.summary().mediumCount()).isEqualTo(5L);
    assertThat(result.summary().lowCount()).isEqualTo(6L);
    assertThat(result.summary().infoCount()).isEqualTo(0L);

    assertThat(result.items()).hasSize(2);
    assertThat(result.items().get(0).scanId()).isEqualTo(1002L);
    assertThat(result.items().get(0).projectId()).isEqualTo(102L);
    assertThat(result.items().get(0).totalFindingCount()).isEqualTo(5L);
    assertThat(result.items().get(0).criticalCount()).isEqualTo(1L);
    assertThat(result.items().get(0).highCount()).isEqualTo(2L);
    assertThat(result.items().get(0).mediumCount()).isEqualTo(0L);
    assertThat(result.items().get(0).lowCount()).isEqualTo(2L);
    assertThat(result.items().get(0).infoCount()).isEqualTo(0L);

    assertThat(result.items().get(1).scanId()).isEqualTo(1001L);
    assertThat(result.items().get(1).scanMode()).isEqualTo(ScanMode.UPLOAD);
    assertThat(result.items().get(1).totalFindingCount()).isEqualTo(12L);
    assertThat(result.items().get(1).criticalCount()).isEqualTo(0L);
    assertThat(result.items().get(1).highCount()).isEqualTo(3L);
    assertThat(result.items().get(1).mediumCount()).isEqualTo(5L);
    assertThat(result.items().get(1).lowCount()).isEqualTo(4L);
    assertThat(result.items().get(1).infoCount()).isEqualTo(0L);
  }

  @Test
  void getCurrentUserScanHistoryThrowsForbiddenForGuest() {
    given(currentActorProvider.getCurrentActor()).willReturn(AuthenticatedActor.guest("guest-hash"));

    assertThatThrownBy(() -> historyScanQueryService.getCurrentUserScanHistory())
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
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
