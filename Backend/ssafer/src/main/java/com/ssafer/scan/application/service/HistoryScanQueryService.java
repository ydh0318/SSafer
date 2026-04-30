package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.HistoryScanListItemResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.api.dto.HistoryScanSummaryCountResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HistoryScanQueryService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;

  @Transactional(readOnly = true)
  public HistoryScanListResponse getCurrentUserScanHistory() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();

    // 전체 히스토리 조회는 로그인한 회원 본인의 스캔 이력만 제공한다.
    // 게스트는 회원 히스토리를 볼 수 없으므로 명시적으로 차단한다.
    if (!actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    // 현재 회원이 직접 요청한 스캔을 최신순으로 조회한다.
    // 페이지네이션과 필터는 다음 태스크에서 붙더라도 기본 조회 축은 그대로 유지된다.
    List<Scan> scans = scanRepository.findByRequestedByUserIdOrderByRequestedAtDescIdDesc(actor.userId());

    // 히스토리 화면에서는 "스캔이 몇 개 있었는가"보다 "어떤 위험도가 얼마나 있었는가"가 더 중요하다.
    // 그래서 스캔별 severity 집계를 먼저 만든 뒤, 이 값을 summary와 item 응답에서 함께 사용한다.
    Map<Long, Map<Severity, Long>> severityCountsByScanId = loadSeverityCounts(scans);

    List<HistoryScanListItemResponse> items = scans.stream()
        .map(scan -> toHistoryItem(scan, severityCountsByScanId))
        .toList();

    return new HistoryScanListResponse(
        buildSummary(scans, severityCountsByScanId),
        items
    );
  }

  private Map<Long, Map<Severity, Long>> loadSeverityCounts(List<Scan> scans) {
    if (scans.isEmpty()) {
      return Map.of();
    }

    List<Long> scanIds = scans.stream()
        .map(Scan::getId)
        .toList();

    // {scanId, severity, count} 묶음 결과를 한 번에 가져와서
    // item별 위험도 분포와 summary 전체 위험도 분포를 중복 쿼리 없이 만들 수 있게 한다.
    Map<Long, Map<Severity, Long>> severityCountsByScanId = new HashMap<>();

    for (Object[] row : scanFindingRepository.countSeverityByScanIds(scanIds)) {
      Long scanId = ((Number) row[0]).longValue();
      Severity severity = (Severity) row[1];
      Long count = ((Number) row[2]).longValue();

      severityCountsByScanId
          .computeIfAbsent(scanId, ignored -> new EnumMap<>(Severity.class))
          .put(severity, count);
    }

    return severityCountsByScanId;
  }

  private HistoryScanSummaryCountResponse buildSummary(
      List<Scan> scans,
      Map<Long, Map<Severity, Long>> severityCountsByScanId
  ) {
    long totalFindingCount = 0L;
    Map<Severity, Long> severityTotals = new EnumMap<>(Severity.class);

    // 스캔별로 모아 둔 severity count를 다시 합산해서
    // 현재 히스토리 응답 범위 전체의 위험도 분포 summary를 만든다.
    for (Scan scan : scans) {
      Map<Severity, Long> severityCounts = severityCountsByScanId.getOrDefault(scan.getId(), Map.of());
      for (Map.Entry<Severity, Long> entry : severityCounts.entrySet()) {
        severityTotals.merge(entry.getKey(), entry.getValue(), Long::sum);
        totalFindingCount += entry.getValue();
      }
    }

    return new HistoryScanSummaryCountResponse(
        scans.size(),
        totalFindingCount,
        severityTotals.getOrDefault(Severity.CRITICAL, 0L),
        severityTotals.getOrDefault(Severity.HIGH, 0L),
        severityTotals.getOrDefault(Severity.MEDIUM, 0L),
        severityTotals.getOrDefault(Severity.LOW, 0L),
        severityTotals.getOrDefault(Severity.INFO, 0L)
    );
  }

  private HistoryScanListItemResponse toHistoryItem(
      Scan scan,
      Map<Long, Map<Severity, Long>> severityCountsByScanId
  ) {
    // 각 스캔 row는 "총 몇 개가 나왔는지"와 "무슨 위험도가 많았는지"를 바로 보여줘야 한다.
    // 그래서 목록 item에도 위험도별 개수를 펼쳐서 담는다.
    Map<Severity, Long> severityCounts = severityCountsByScanId.getOrDefault(scan.getId(), Map.of());
    long criticalCount = severityCounts.getOrDefault(Severity.CRITICAL, 0L);
    long highCount = severityCounts.getOrDefault(Severity.HIGH, 0L);
    long mediumCount = severityCounts.getOrDefault(Severity.MEDIUM, 0L);
    long lowCount = severityCounts.getOrDefault(Severity.LOW, 0L);
    long infoCount = severityCounts.getOrDefault(Severity.INFO, 0L);

    return new HistoryScanListItemResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getStatus(),
        scan.getScanMode(),
        criticalCount + highCount + mediumCount + lowCount + infoCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        infoCount,
        scan.getRequestedAt(),
        scan.getCompletedAt()
    );
  }
}
