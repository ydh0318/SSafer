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
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ScanFindingListQueryServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private ScanFindingRepository scanFindingRepository;

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private ScanFindingListQueryService scanFindingListQueryService;

  @Test
  void getScanFindingsReturnsMappedList() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 5))
        .build();
    ScanFinding finding = ScanFinding.builder()
        .id(2001L)
        .scanId(1001L)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("fp-1")
        .severity(Severity.HIGH)
        .category("CONFIG")
        .title("Image user should not be 'root'")
        .filePath("Dockerfile")
        .lineNumber(2)
        .resourceName("Dockerfile")
        .ruleCode("DS-0002")
        .resolutionStatus(ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.of(2026, 4, 27, 9, 30))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.findByScanIdOrderByCreatedAtDesc(1001L))
        .thenReturn(List.of(finding));

    List<ScanFindingListItemResponse> response = scanFindingListQueryService.getScanFindings(1001L);

    assertThat(response).hasSize(1);
    assertThat(response.getFirst().findingId()).isEqualTo(2001L);
    assertThat(response.getFirst().scanId()).isEqualTo(1001L);
    assertThat(response.getFirst().scanNodeId()).isEqualTo(3001L);
    assertThat(response.getFirst().severity()).isEqualTo(Severity.HIGH);
    assertThat(response.getFirst().lineNumber()).isEqualTo(2);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void getScanFindingsWhenMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanFindingListQueryService.getScanFindings(999L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanFindingsWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 5))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> scanFindingListQueryService.getScanFindings(1001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }
}
