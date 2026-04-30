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
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class HistoryScanQueryServiceTest {

  private ScanRepository scanRepository;
  private CurrentActorProvider currentActorProvider;
  private HistoryScanQueryService historyScanQueryService;

  @BeforeEach
  void setUp() {
    scanRepository = Mockito.mock(ScanRepository.class);
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    historyScanQueryService = new HistoryScanQueryService(scanRepository, currentActorProvider);
  }

  @Test
  void getCurrentUserScanHistoryReturnsCurrentMemberScans() {
    given(currentActorProvider.getCurrentActor()).willReturn(AuthenticatedActor.member(1L));
    given(scanRepository.findByRequestedByUserIdOrderByRequestedAtDescIdDesc(1L))
        .willReturn(List.of(
            createScan(1002L, 102L, ScanStatus.RUNNING, ScanMode.AGENT),
            createScan(1001L, 101L, ScanStatus.DONE, ScanMode.UPLOAD)
        ));

    HistoryScanListResponse result = historyScanQueryService.getCurrentUserScanHistory();

    assertThat(result.items()).hasSize(2);
    assertThat(result.items().get(0).scanId()).isEqualTo(1002L);
    assertThat(result.items().get(0).projectId()).isEqualTo(102L);
    assertThat(result.items().get(1).scanId()).isEqualTo(1001L);
    assertThat(result.items().get(1).scanMode()).isEqualTo(ScanMode.UPLOAD);
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
