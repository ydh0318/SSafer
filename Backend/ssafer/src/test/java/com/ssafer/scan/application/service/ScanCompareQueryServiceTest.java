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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ScanCompareQueryServiceTest {

  private ScanRepository scanRepository;
  private ScanFindingRepository scanFindingRepository;
  private CurrentActorProvider currentActorProvider;
  private ProjectAuthorizationService projectAuthorizationService;
  private ScanCompareQueryService scanCompareQueryService;

  @BeforeEach
  void setUp() {
    scanRepository = Mockito.mock(ScanRepository.class);
    scanFindingRepository = Mockito.mock(ScanFindingRepository.class);
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    scanCompareQueryService = new ScanCompareQueryService(
        scanRepository,
        scanFindingRepository,
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
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1001L)).willReturn(List.of());
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1002L)).willReturn(List.of());

    ScanCompareResponse response = scanCompareQueryService.compare(1001L, 1002L);

    assertThat(response.baseScanId()).isEqualTo(1001L);
    assertThat(response.targetScanId()).isEqualTo(1002L);
    assertThat(response.projectId()).isEqualTo(101L);
    assertThat(response.baseStatus()).isEqualTo(ScanStatus.DONE);
    assertThat(response.targetStatus()).isEqualTo(ScanStatus.RUNNING);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void loadCompareContextReturnsFindingsIndexedByFingerprint() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan baseScan = createScan(1001L, 101L, ScanStatus.DONE);
    Scan targetScan = createScan(1002L, 101L, ScanStatus.DONE);
    ScanFinding baseFinding = createFinding(11L, 1001L, "sha256:ABC123", Severity.HIGH, "Hardcoded secret");
    ScanFinding targetFinding = createFinding(22L, 1002L, "sha256:abc123", Severity.LOW, "Hardcoded secret changed");

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(scanRepository.findById(1001L)).willReturn(Optional.of(baseScan));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(targetScan));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1001L)).willReturn(List.of(baseFinding));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1002L)).willReturn(List.of(targetFinding));

    ScanCompareContext context = scanCompareQueryService.loadCompareContext(1001L, 1002L);

    assertThat(context.baseFindings()).hasSize(1);
    assertThat(context.targetFindings()).hasSize(1);
    assertThat(context.baseFindingsByComparisonKey()).containsKey("sha256:abc123");
    assertThat(context.targetFindingsByComparisonKey()).containsKey("sha256:abc123");
    assertThat(context.baseFindings().getFirst().isSameFinding(context.targetFindings().getFirst())).isTrue();
  }

  @Test
  void loadCompareContextWhenSameFingerprintExistsTwiceKeepsFirstFindingAsRepresentative() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan baseScan = createScan(1001L, 101L, ScanStatus.DONE);
    Scan targetScan = createScan(1002L, 101L, ScanStatus.DONE);
    ScanFinding firstFinding = createFinding(11L, 1001L, "sha256:abc123", Severity.HIGH, "First finding");
    ScanFinding duplicatedFinding = createFinding(12L, 1001L, "sha256:abc123", Severity.HIGH, "Duplicated finding");

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(scanRepository.findById(1001L)).willReturn(Optional.of(baseScan));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(targetScan));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1001L)).willReturn(List.of(firstFinding, duplicatedFinding));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1002L)).willReturn(List.of());

    ScanCompareContext context = scanCompareQueryService.loadCompareContext(1001L, 1002L);

    assertThat(context.baseFindingsByComparisonKey()).hasSize(1);
    assertThat(context.baseFindingsByComparisonKey().get("sha256:abc123").findingId()).isEqualTo(11L);
  }

  @Test
  void loadCompareContextWhenFingerprintMissingUsesFallbackComparisonKey() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan baseScan = createScan(1001L, 101L, ScanStatus.DONE);
    Scan targetScan = createScan(1002L, 101L, ScanStatus.DONE);
    ScanFinding baseFinding = createFinding(11L, 1001L, "   ", Severity.HIGH, "Same title");
    ScanFinding targetFinding = createFinding(22L, 1002L, null, Severity.LOW, "Same title");

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(scanRepository.findById(1001L)).willReturn(Optional.of(baseScan));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(targetScan));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1001L)).willReturn(List.of(baseFinding));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1002L)).willReturn(List.of(targetFinding));

    ScanCompareContext context = scanCompareQueryService.loadCompareContext(1001L, 1002L);

    assertThat(context.baseFindings().getFirst().comparisonKey())
        .startsWith("fallback:custom_rule|env_plain_secret|.env|1|same title");
    assertThat(context.baseFindings().getFirst().isSameFinding(context.targetFindings().getFirst())).isTrue();
  }

  @Test
  void classifySplitsNewResolvedAndRetainedFindings() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan baseScan = createScan(1001L, 101L, ScanStatus.DONE);
    Scan targetScan = createScan(1002L, 101L, ScanStatus.DONE);
    ScanFinding resolvedFinding = createFinding(11L, 1001L, "sha256:resolved", Severity.HIGH, "Resolved finding");
    ScanFinding retainedBaseFinding = createFinding(12L, 1001L, "sha256:retained", Severity.HIGH, "Retained base");
    ScanFinding retainedTargetFinding = createFinding(21L, 1002L, "sha256:retained", Severity.LOW, "Retained target");
    ScanFinding newFinding = createFinding(22L, 1002L, "sha256:new", Severity.MEDIUM, "New finding");

    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(scanRepository.findById(1001L)).willReturn(Optional.of(baseScan));
    given(scanRepository.findById(1002L)).willReturn(Optional.of(targetScan));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1001L))
        .willReturn(List.of(resolvedFinding, retainedBaseFinding));
    given(scanFindingRepository.findAllByScanIdOrderByIdAsc(1002L))
        .willReturn(List.of(retainedTargetFinding, newFinding));

    ScanCompareClassificationResult result = scanCompareQueryService.classify(1001L, 1002L);

    assertThat(result.newFindings()).extracting(ScanCompareFindingCandidate::findingId)
        .containsExactly(22L);
    assertThat(result.resolvedFindings()).extracting(ScanCompareFindingCandidate::findingId)
        .containsExactly(11L);
    assertThat(result.retainedFindings()).hasSize(1);
    assertThat(result.retainedFindings().getFirst().baseFinding().findingId()).isEqualTo(12L);
    assertThat(result.retainedFindings().getFirst().targetFinding().findingId()).isEqualTo(21L);
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

  private ScanFinding createFinding(
      Long findingId,
      Long scanId,
      String fingerprint,
      Severity severity,
      String title
  ) {
    return ScanFinding.builder()
        .id(findingId)
        .scanId(scanId)
        .scanNodeId(500L)
        .sourceType(FindingSourceType.CUSTOM_RULE)
        .fingerprint(fingerprint)
        .severity(severity)
        .category("SECRET")
        .title(title)
        .description("설명")
        .filePath(".env")
        .lineNumber(1)
        .resourceName("cli")
        .ruleCode("ENV_PLAIN_SECRET")
        .attackScenario("시나리오")
        .remediationGuide("가이드")
        .rawSnippetJson("{}")
        .resolutionStatus(ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.of(2026, 5, 6, 10, 0))
        .build();
  }
}
