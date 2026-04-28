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
import com.ssafer.scan.api.dto.ScanStatusResponse;
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
class ScanStatusQueryServiceTest {

  @Mock
  private ScanRepository scanRepository;
  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private ScanStatusQueryService scanStatusQueryService;

  @Test
  void getScanStatusReturnsResponse() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 27, 9, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime completedAt = requestedAt.plusMinutes(3);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.FAILED)
        .progressStep("ANALYSIS_FAILED")
        .failureReason("Agent timeout")
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .completedAt(completedAt)
        .lastUpdatedAt(completedAt)
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));

    ScanStatusResponse response = scanStatusQueryService.getScanStatus(1001L);

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.status()).isEqualTo(ScanStatus.FAILED);
    assertThat(response.progressStep()).isEqualTo("ANALYSIS_FAILED");
    assertThat(response.errorMessage()).isEqualTo("Agent timeout");
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void getScanStatusWhenMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanStatusQueryService.getScanStatus(999L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanStatusWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 1))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> scanStatusQueryService.getScanStatus(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }
}
