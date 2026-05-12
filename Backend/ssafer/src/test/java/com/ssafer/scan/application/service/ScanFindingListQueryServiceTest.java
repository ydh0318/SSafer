package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanFindingListResponseData;
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
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

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
  void getScanFindingsReturnsPagedResponse() {
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
    Page<ScanFinding> findingPage = new PageImpl<>(
        java.util.List.of(finding),
        PageRequest.of(1, 10),
        11
    );

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.findAll(any(Specification.class), any(Pageable.class)))
        .thenReturn(findingPage);

    ScanFindingListResponseData response = scanFindingListQueryService.getScanFindings(
        1001L,
        Severity.HIGH,
        "CONFIG",
        FindingSourceType.TRIVY,
        ResolutionStatus.OPEN,
        3001L,
        1,
        10
    );

    assertThat(response.items()).hasSize(1);
    assertThat(response.items().getFirst().findingId()).isEqualTo(2001L);
    assertThat(response.page()).isEqualTo(1);
    assertThat(response.size()).isEqualTo(10);
    assertThat(response.totalElements()).isEqualTo(11L);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);

    ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
    verify(scanFindingRepository).findAll(any(Specification.class), pageableCaptor.capture());
    assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(1);
    assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(10);
    assertThat(pageableCaptor.getValue().getSort().toString()).isEqualTo("createdAt: DESC,id: DESC");
  }

  @Test
  void getScanFindingsWhenPageInvalidThrowsInvalidParameter() {
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

    assertThatThrownBy(() -> scanFindingListQueryService.getScanFindings(
        1001L, null, null, null, null, null, -1, 20))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void getScanFindingsWhenMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanFindingListQueryService.getScanFindings(
        999L, null, null, null, null, null, 0, 20))
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

    assertThatThrownBy(() -> scanFindingListQueryService.getScanFindings(
        1001L, null, null, null, null, null, 0, 20))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void getScanFindingsCapsPageSizeToMax() {
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
    Page<ScanFinding> findingPage = new PageImpl<>(java.util.List.of(), PageRequest.of(0, 100), 0);

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.findAll(any(Specification.class), any(Pageable.class)))
        .thenReturn(findingPage);

    scanFindingListQueryService.getScanFindings(
        1001L,
        null,
        null,
        null,
        null,
        null,
        0,
        1000
    );

    ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
    verify(scanFindingRepository).findAll(any(Specification.class), pageableCaptor.capture());
    assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
  }
}
