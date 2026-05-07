package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.DeleteScanResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ScanDeletionServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private ScanDeletionService scanDeletionService;

  @Test
  void deleteScanSoftDeletesAndReturnsResponse() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = createScan(ScanStatus.DONE);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    DeleteScanResponseData response = scanDeletionService.deleteScan(1001L);

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.deletedAt()).isNotNull();
    assertThat(scan.isDeleted()).isTrue();
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void deleteScanWhenStatusIsRunningThrowsConflict() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(createScan(ScanStatus.RUNNING)));

    assertThatThrownBy(() -> scanDeletionService.deleteScan(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_STATUS_CONFLICT);
  }

  @Test
  void deleteScanWhenMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findByIdForUpdate(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanDeletionService.deleteScan(999L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void deleteScanWhenAlreadyDeletedThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    Scan scan = createScan(ScanStatus.DONE);
    scan.softDelete();
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(scan));

    assertThatThrownBy(() -> scanDeletionService.deleteScan(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void deleteScanWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findByIdForUpdate(1001L)).thenReturn(Optional.of(createScan(ScanStatus.DONE)));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> scanDeletionService.deleteScan(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  private Scan createScan(ScanStatus status) {
    return Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(status)
        .requestedAt(LocalDateTime.of(2026, 5, 1, 10, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 1, 10, 0))
        .build();
  }
}
