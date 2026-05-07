package com.ssafer.scan.application.service;

import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.api.dto.ProjectScanOptionsResponseData;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
// 프로젝트별 점검 옵션(기본 모드/실사용 가능 모드/에이전트 가용성) 조회를 담당한다.
public class ProjectScanOptionQueryService {

  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final AgentRepository agentRepository;

  @Transactional(readOnly = true)
  public ProjectScanOptionsResponseData getScanOptions(Long projectId) {
    // 조회 요청자 권한 범위에서 프로젝트를 로드한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);

    // AGENT 사용 가능 여부는 Worker가 아닌 Local Agent ONLINE 상태 기준으로만 판단한다.
    boolean agentAvailable = agentRepository.existsByProjectIdAndStatus(projectId, AgentStatus.ONLINE);
    // 정책: UPLOAD는 항상 가능, AGENT는 실제 ONLINE Agent가 있을 때만 노출한다.
    List<ScanMode> availableScanModes = agentAvailable
        ? List.of(ScanMode.UPLOAD, ScanMode.AGENT)
        : List.of(ScanMode.UPLOAD);

    // defaultScanMode는 현재 가용성과 무관하게 프로젝트 설정값을 그대로 내려준다.
    return new ProjectScanOptionsResponseData(
        project.getDefaultScanMode(),
        availableScanModes,
        project.isMonitorEnabled(),
        agentAvailable
    );
  }
}
