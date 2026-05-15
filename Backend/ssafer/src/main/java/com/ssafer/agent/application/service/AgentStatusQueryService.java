package com.ssafer.agent.application.service;

import com.ssafer.agent.api.dto.AgentStatusResponseData;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentStatusQueryService {

  private static final List<AgentTaskStatus> INCOMPLETE_STATUSES = AgentTaskStatus.resendTargetStatuses();

  private final ProjectAuthorizationService projectAuthorizationService;
  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;

  public AgentStatusQueryService(
      ProjectAuthorizationService projectAuthorizationService,
      AgentRepository agentRepository,
      AgentTaskRepository agentTaskRepository
  ) {
    this.projectAuthorizationService = projectAuthorizationService;
    this.agentRepository = agentRepository;
    this.agentTaskRepository = agentTaskRepository;
  }

  @Transactional(readOnly = true)
  public AgentStatusResponseData getAgentStatus(Long projectId, AuthenticatedActor actor) {
    // 프로젝트 존재/권한을 먼저 검증하고 해당 프로젝트의 agent 상태를 조회한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);

    Agent agent = agentRepository.findLatestByProjectIdAndStatus(projectId, AgentStatus.ONLINE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    AgentTask latestIncompleteTask = agentTaskRepository
        .findFirstByAgentIdAndTaskStatusInOrderByQueuedAtDescIdDesc(agent.getId(), INCOMPLETE_STATUSES)
        .orElse(null);

    return new AgentStatusResponseData(
        agent.getId(),
        agent.getStatus(),
        agent.getConnectedAt(),
        agent.getLastSeenAt(),
        latestIncompleteTask == null ? null : latestIncompleteTask.getTaskType()
    );
  }
}
