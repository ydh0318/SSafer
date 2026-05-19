package com.ssafer.scan.application.service;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.FindingOpenSummaryResponseData;
import com.ssafer.scan.api.dto.FindingOpenSummaryScopeResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
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
public class FindingOpenSummaryQueryService {

  private static final String WORKSPACE_SCOPE = "WORKSPACE";
  private static final String PROJECT_SCOPE = "PROJECT";
  private static final List<ResolutionStatus> OPEN_STATUSES = List.of(
      ResolutionStatus.OPEN,
      ResolutionStatus.IN_PROGRESS
  );

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public FindingOpenSummaryResponseData getOpenSummary(Long projectId) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    ScopeContext scopeContext = resolveScope(actor, projectId);
    if (scopeContext.projectIds().isEmpty()) {
      return emptySummary(scopeContext.scope());
    }

    List<Long> latestDoneScanIds = loadLatestDoneScanIds(scopeContext.projectIds());
    if (latestDoneScanIds.isEmpty()) {
      return emptySummary(scopeContext.scope());
    }

    Map<Severity, Long> bySeverity = initializeSeverityCounts();
    long openCount = 0L;

    for (Object[] row : scanFindingRepository.countSeverityByScanIdsAndResolutionStatuses(
        latestDoneScanIds,
        OPEN_STATUSES
    )) {
      Severity severity = (Severity) row[0];
      long count = ((Number) row[1]).longValue();
      bySeverity.put(severity, count);
      openCount += count;
    }

    return new FindingOpenSummaryResponseData(
        scopeContext.scope(),
        openCount,
        bySeverity,
        OPEN_STATUSES
    );
  }

  private ScopeContext resolveScope(AuthenticatedActor actor, Long projectId) {
    if (projectId != null) {
      Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);
      return new ScopeContext(
          new FindingOpenSummaryScopeResponse(PROJECT_SCOPE, project.getId()),
          List.of(project.getId())
      );
    }

    List<Long> projectIds = projectAuthorizationService.loadAuthorizedProjects(actor).stream()
        .map(Project::getId)
        .toList();
    return new ScopeContext(
        new FindingOpenSummaryScopeResponse(WORKSPACE_SCOPE, null),
        projectIds
    );
  }

  private List<Long> loadLatestDoneScanIds(List<Long> projectIds) {
    Map<Long, Long> latestScanIdsByProjectId = new LinkedHashMap<>();
    for (Scan scan : scanRepository.findLatestScansByProjectIdsAndStatus(projectIds, ScanStatus.DONE)) {
      latestScanIdsByProjectId.putIfAbsent(scan.getProjectId(), scan.getId());
    }
    return latestScanIdsByProjectId.values().stream().toList();
  }

  private FindingOpenSummaryResponseData emptySummary(FindingOpenSummaryScopeResponse scope) {
    return new FindingOpenSummaryResponseData(
        scope,
        0L,
        initializeSeverityCounts(),
        OPEN_STATUSES
    );
  }

  private Map<Severity, Long> initializeSeverityCounts() {
    Map<Severity, Long> bySeverity = new EnumMap<>(Severity.class);
    for (Severity severity : Severity.values()) {
      bySeverity.put(severity, 0L);
    }
    return bySeverity;
  }

  private record ScopeContext(
      FindingOpenSummaryScopeResponse scope,
      List<Long> projectIds
  ) {
  }
}
