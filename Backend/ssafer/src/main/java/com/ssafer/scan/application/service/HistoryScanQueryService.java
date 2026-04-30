package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.HistoryScanListItemResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.api.dto.HistoryScanSummaryCountResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HistoryScanQueryService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 100;

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public HistoryScanListResponse getCurrentUserScanHistory(
      Integer page,
      Integer size,
      Long projectId,
      ScanStatus status,
      ScanMode scanMode
  ) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();

    // 전체 히스토리는 회원 전용으로 제한한다.
    // 현재 구조상 게스트는 회원 히스토리 화면을 사용할 수 없으므로 초기에 차단한다.
    if (!actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    Pageable pageable = buildPageable(page, size);
    List<Long> authorizedProjectIds = resolveAuthorizedProjectIds(actor, projectId);
    if (authorizedProjectIds.isEmpty()) {
      return new HistoryScanListResponse(
          new HistoryScanSummaryCountResponse(0L, 0L, 0L, 0L, 0L, 0L, 0L),
          List.of(),
          pageable.getPageNumber(),
          pageable.getPageSize(),
          0L,
          0
      );
    }

    Specification<Scan> specification = buildSpecification(authorizedProjectIds, status, scanMode);
    Page<Scan> scanPage = scanRepository.findAll(specification, pageable);

    // item용 집계는 현재 페이지의 scanIds만 대상으로 제한한다.
    // 이전처럼 필터 전체 scan을 전부 읽고 그 scanIds로 집계하지 않아서 page size와 비용이 더 잘 맞는다.
    Map<Long, Map<Severity, Long>> pageSeverityCountsByScanId = loadSeverityCounts(scanPage.getContent());

    List<HistoryScanListItemResponse> items = scanPage.getContent().stream()
        .map(scan -> toHistoryItem(scan, pageSeverityCountsByScanId))
        .toList();

    // summary는 현재 페이지가 아니라 "현재 필터 전체 결과"를 기준으로 계산해야 의미가 맞는다.
    // 다만 이때 전체 Scan 엔티티를 로딩하지 않고 DB aggregate 결과만 받아서 summary를 만든다.
    HistoryScanSummaryCountResponse summary = buildSummary(
        scanPage.getTotalElements(),
        authorizedProjectIds,
        status,
        scanMode
    );

    return new HistoryScanListResponse(
        summary,
        items,
        scanPage.getNumber(),
        scanPage.getSize(),
        scanPage.getTotalElements(),
        scanPage.getTotalPages()
    );
  }

  private Pageable buildPageable(Integer page, Integer size) {
    int normalizedPage = page == null ? DEFAULT_PAGE : page;
    int normalizedSize = size == null ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    if (normalizedPage < 0 || normalizedSize < 1) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 히스토리 목록은 최신 요청이 먼저 오도록 requestedAt DESC, id DESC를 고정한다.
    return PageRequest.of(
        normalizedPage,
        normalizedSize,
        Sort.by(Sort.Order.desc("requestedAt"), Sort.Order.desc("id"))
    );
  }

  private List<Long> resolveAuthorizedProjectIds(AuthenticatedActor actor, Long projectId) {
    if (projectId != null) {
      // 특정 프로젝트로 필터링하는 경우에는 존재 여부와 소유 권한을 즉시 검증한다.
      Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);
      return List.of(project.getId());
    }

    // 프로젝트 필터가 없으면 회원이 접근 가능한 프로젝트 전체 범위를 히스토리 조회 대상으로 삼는다.
    return projectAuthorizationService.loadAuthorizedProjects(actor).stream()
        .map(Project::getId)
        .toList();
  }

  private Specification<Scan> buildSpecification(
      List<Long> authorizedProjectIds,
      ScanStatus status,
      ScanMode scanMode
  ) {
    return (root, query, criteriaBuilder) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(root.get("projectId").in(authorizedProjectIds));
      if (status != null) {
        predicates.add(criteriaBuilder.equal(root.get("status"), status));
      }
      if (scanMode != null) {
        predicates.add(criteriaBuilder.equal(root.get("scanMode"), scanMode));
      }
      return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
    };
  }

  private Map<Long, Map<Severity, Long>> loadSeverityCounts(List<Scan> scans) {
    if (scans.isEmpty()) {
      return Map.of();
    }

    List<Long> scanIds = scans.stream()
        .map(Scan::getId)
        .toList();

    // 현재 페이지에 실제로 표시할 scanIds만 대상으로 severity 분포를 묶음 조회한다.
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
      long totalScanCount,
      List<Long> authorizedProjectIds,
      ScanStatus status,
      ScanMode scanMode
  ) {
    if (totalScanCount == 0L) {
      return new HistoryScanSummaryCountResponse(0L, 0L, 0L, 0L, 0L, 0L, 0L);
    }

    long totalFindingCount = 0L;
    Map<Severity, Long> severityTotals = new EnumMap<>(Severity.class);

    // summary는 필터 전체 결과 기준이어야 하지만, 그 때문에 전체 Scan 엔티티를 읽을 필요는 없다.
    // DB aggregate 결과만 받아 severity별 합계와 totalFindingCount를 만든다.
    for (Object[] row : scanFindingRepository.countSeveritySummaryForHistory(
        authorizedProjectIds,
        status,
        scanMode
    )) {
      Severity severity = (Severity) row[0];
      Long count = ((Number) row[1]).longValue();
      severityTotals.put(severity, count);
      totalFindingCount += count;
    }

    return new HistoryScanSummaryCountResponse(
        totalScanCount,
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
    // 각 스캔 row는 총 몇 개가 나왔는지와 어떤 위험도가 많았는지를 바로 보여줘야 한다.
    // 그래서 목록 item에도 위험도별 count를 펼쳐서 담는다.
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
