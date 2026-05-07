package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanCompareFindingResponse;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.api.dto.ScanCompareSeverityChangedFindingResponse;
import com.ssafer.scan.api.dto.ScanCompareSummaryResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanCompareQueryService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanCompareResponse compare(Long baseScanId, Long targetScanId) {
    ScanCompareContext context = loadCompareContext(baseScanId, targetScanId);
    ScanCompareClassificationResult classificationResult = classify(context);

    List<ScanCompareFindingResponse> newFindings = classificationResult.newFindings().stream()
        .map(this::toFindingResponse)
        .toList();
    List<ScanCompareFindingResponse> resolvedFindings = classificationResult.resolvedFindings().stream()
        .map(this::toFindingResponse)
        .toList();

    List<ScanCompareFindingResponse> retainedFindings = new ArrayList<>();
    List<ScanCompareSeverityChangedFindingResponse> severityChangedFindings = new ArrayList<>();

    for (ScanCompareMatchedFinding retainedFinding : classificationResult.retainedFindings()) {
      if (retainedFinding.baseFinding().severity() == retainedFinding.targetFinding().severity()) {
        retainedFindings.add(toFindingResponse(retainedFinding.targetFinding()));
        continue;
      }

      severityChangedFindings.add(new ScanCompareSeverityChangedFindingResponse(
          toFindingResponse(retainedFinding.baseFinding()),
          toFindingResponse(retainedFinding.targetFinding()),
          retainedFinding.baseFinding().severity(),
          retainedFinding.targetFinding().severity()
      ));
    }

    ScanCompareSummaryResponse summary = new ScanCompareSummaryResponse(
        context.baseFindings().size(),
        context.targetFindings().size(),
        newFindings.size(),
        resolvedFindings.size(),
        retainedFindings.size(),
        severityChangedFindings.size()
    );

    return new ScanCompareResponse(
        context.baseScan().getId(),
        context.targetScan().getId(),
        context.baseScan().getProjectId(),
        context.baseScan().getStatus(),
        context.targetScan().getStatus(),
        summary,
        newFindings,
        resolvedFindings,
        retainedFindings,
        severityChangedFindings
    );
  }

  @Transactional(readOnly = true)
  public ScanCompareContext loadCompareContext(Long baseScanId, Long targetScanId) {
    if (baseScanId == null || targetScanId == null || baseScanId.equals(targetScanId)) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan baseScan = scanRepository.findById(baseScanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Scan targetScan = scanRepository.findById(targetScanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 결과 비교는 같은 프로젝트 안의 두 스캔만 허용한다.
    if (!baseScan.getProjectId().equals(targetScan.getProjectId())) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 결과 비교는 적재까지 끝난 DONE 스캔끼리만 허용한다.
    assertComparableScanStatus(baseScan);
    assertComparableScanStatus(targetScan);

    // 같은 프로젝트의 스캔이므로 한 번의 프로젝트 권한 검증으로 비교 가능 여부를 확인한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(baseScan.getProjectId(), actor);

    List<ScanCompareFindingCandidate> baseFindings = loadCompareFindingCandidates(baseScan.getId());
    List<ScanCompareFindingCandidate> targetFindings = loadCompareFindingCandidates(targetScan.getId());

    return new ScanCompareContext(
        baseScan,
        targetScan,
        baseFindings,
        targetFindings,
        indexByComparisonKey(baseFindings),
        indexByComparisonKey(targetFindings)
    );
  }

  @Transactional(readOnly = true)
  public ScanCompareClassificationResult classify(Long baseScanId, Long targetScanId) {
    return classify(loadCompareContext(baseScanId, targetScanId));
  }

  public ScanCompareClassificationResult classify(ScanCompareContext context) {
    List<ScanCompareFindingCandidate> newFindings = new ArrayList<>();
    List<ScanCompareFindingCandidate> resolvedFindings = new ArrayList<>();
    List<ScanCompareMatchedFinding> retainedFindings = new ArrayList<>();

    for (ScanCompareFindingCandidate targetFinding : context.targetFindings()) {
      ScanCompareFindingCandidate matchedBaseFinding =
          context.baseFindingsByComparisonKey().get(targetFinding.comparisonKey());

      if (matchedBaseFinding == null) {
        newFindings.add(targetFinding);
        continue;
      }

      retainedFindings.add(new ScanCompareMatchedFinding(matchedBaseFinding, targetFinding));
    }

    for (ScanCompareFindingCandidate baseFinding : context.baseFindings()) {
      if (!context.targetFindingsByComparisonKey().containsKey(baseFinding.comparisonKey())) {
        resolvedFindings.add(baseFinding);
      }
    }

    return new ScanCompareClassificationResult(newFindings, resolvedFindings, retainedFindings);
  }

  private List<ScanCompareFindingCandidate> loadCompareFindingCandidates(Long scanId) {
    return scanFindingRepository.findAllByScanIdOrderByIdAsc(scanId).stream()
        .map(ScanCompareFindingCandidate::from)
        .toList();
  }

  private Map<String, ScanCompareFindingCandidate> indexByComparisonKey(
      List<ScanCompareFindingCandidate> findings
  ) {
    Map<String, ScanCompareFindingCandidate> indexed = new LinkedHashMap<>();
    for (ScanCompareFindingCandidate finding : findings) {
      // 동일 비교 키가 여러 번 나오면 첫 번째 finding을 대표값으로 사용한다.
      indexed.putIfAbsent(finding.comparisonKey(), finding);
    }
    return indexed;
  }

  private ScanCompareFindingResponse toFindingResponse(ScanCompareFindingCandidate finding) {
    return new ScanCompareFindingResponse(
        finding.findingId(),
        finding.scanId(),
        finding.comparisonKey(),
        finding.fingerprint(),
        finding.sourceType(),
        finding.severity(),
        finding.category(),
        finding.title(),
        finding.filePath(),
        finding.lineNumber(),
        finding.ruleCode()
    );
  }

  private void assertComparableScanStatus(Scan scan) {
    if (scan.getStatus() != ScanStatus.DONE) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
  }
}
