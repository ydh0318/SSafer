package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanSummaryQueryService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final ScanNodeRepository scanNodeRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanSummaryResponse getScanSummary(Long scanId) {
    // 기본 조회와 동일하게 현재 요청 주체 기준으로 프로젝트 접근 권한을 먼저 확인한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    // 맵 형태 집계는 프론트가 그대로 키-값으로 소비할 수 있게 변환해 둔다.
    Map<Severity, Long> severityCounts = toSeverityCountMap(
        scanFindingRepository.countSeverityByScanId(scanId));
    Map<String, Long> categoryCounts = toCountMap(scanFindingRepository.countCategoryByScanId(scanId));
    Map<String, Long> sourceCounts = toCountMap(scanFindingRepository.countSourceTypeByScanId(scanId));
    Map<String, Long> resolutionCounts = toCountMap(scanFindingRepository.countResolutionStatusByScanId(scanId));

    return new ScanSummaryResponse(
        scan.getId(),
        scan.getProjectId(),
        scanFindingRepository.countByScanId(scanId),
        scanNodeRepository.countByScanId(scanId),
        severityCounts.getOrDefault(Severity.CRITICAL, 0L),
        severityCounts.getOrDefault(Severity.HIGH, 0L),
        severityCounts.getOrDefault(Severity.MEDIUM, 0L),
        severityCounts.getOrDefault(Severity.LOW, 0L),
        severityCounts.getOrDefault(Severity.INFO, 0L),
        categoryCounts,
        sourceCounts,
        resolutionCounts
    );
  }

  private Map<Severity, Long> toSeverityCountMap(List<Object[]> rows) {
    Map<Severity, Long> counts = new EnumMap<>(Severity.class);
    // severity 분포는 enum 키를 그대로 유지하면 응답 필드별 카운트를 꺼내기 쉽다.
    for (Object[] row : rows) {
      counts.put((Severity) row[0], ((Number) row[1]).longValue());
    }
    return counts;
  }

  private Map<String, Long> toCountMap(List<Object[]> rows) {
    Map<String, Long> counts = new LinkedHashMap<>();
    // JPA group by 결과를 {키: 개수} 형태로 정리한다.
    for (Object[] row : rows) {
      counts.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
    }
    return counts;
  }
}
