package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ScanCompareQueryServiceTest {

  private ScanRepository scanRepository;
  private CurrentActorProvider currentActorProvider;
  private ProjectAuthorizationService projectAuthorizationService;
  private ScanCompareQueryService scanCompareQueryService;

  @BeforeEach
  void setUp() {
    scanRepository = Mockito.mock(ScanRepository.class);
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    scanCompareQueryService = new ScanCompareQueryService(
        scanRepository,
        currentActorProvider,
        projectAuthorizationService
    );
  }

  @Test
  void compareReturnsBasicMetadataWhenBothScansAuthorized() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan baseScan = createScan(1001L, 101L, ScanStatus.DONE);
    Scan targetScan = createScan(1002L, 101L, ScanStatus.RUNNING);

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(scanRepository.findById(1001L)).willReturn(Optional.of(baseScan));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(targetScan));

    ScanCompareResponse response = scanCompareQueryService.compare(1001L, 1002L);

    assertThat(response.baseScanId()).isEqualTo(1001L);
    assertThat(response.targetScanId()).isEqualTo(1002L);
    assertThat(response.projectId()).isEqualTo(101L);
    assertThat(response.baseStatus()).isEqualTo(ScanStatus.DONE);
    assertThat(response.targetStatus()).isEqualTo(ScanStatus.RUNNING);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void compareWhenSameScanIdsThrowsInvalidParameter() {
    assertThatThrownBy(() -> scanCompareQueryService.compare(1001L, 1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void compareWhenBaseScanMissingThrowsNotFound() {
    given(scanRepository.findById(1001L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> scanCompareQueryService.compare(1001L, 1002L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void compareWhenTargetScanMissingThrowsNotFound() {
    given(scanRepository.findById(1001L)).willReturn(Optional.of(createScan(1001L, 101L, ScanStatus.DONE)));
    given(scanRepository.findById(1002L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> scanCompareQueryService.compare(1001L, 1002L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void compareWhenScansBelongToDifferentProjectsThrowsInvalidParameter() {
    given(scanRepository.findById(1001L)).willReturn(Optional.of(createScan(1001L, 101L, ScanStatus.DONE)));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(createScan(1002L, 202L, ScanStatus.DONE)));

    assertThatThrownBy(() -> scanCompareQueryService.compare(1001L, 1002L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  private Scan createScan(Long scanId, Long projectId, ScanStatus status) {
    return Scan.builder()
        .id(scanId)
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .requestedAt(LocalDateTime.of(2026, 5, 6, 10, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 6, 10, 5))
        .build();
  }
}
