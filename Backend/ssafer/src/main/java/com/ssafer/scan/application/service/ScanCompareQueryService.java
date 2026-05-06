package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
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
    return new ScanCompareResponse(
        context.baseScan().getId(),
        context.targetScan().getId(),
        context.baseScan().getProjectId(),
        context.baseScan().getStatus(),
        context.targetScan().getStatus()
    );
  }

  @Transactional(readOnly = true)
  public ScanCompareContext loadCompareContext(Long baseScanId, Long targetScanId) {
    if (baseScanId == null || targetScanId == null || baseScanId.equals(targetScanId)) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan baseScan = scanRepository.findById(baseScanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Scan targetScan = scanRepository.findById(targetScanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 결과 비교는 같은 프로젝트 안의 두 스캔만 허용한다.
    if (!baseScan.getProjectId().equals(targetScan.getProjectId())) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

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
}
