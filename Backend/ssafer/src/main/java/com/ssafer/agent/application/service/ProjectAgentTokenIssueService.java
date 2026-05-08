package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.ws.AgentSessionRegistry;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import java.io.IOException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.CloseStatus;

@Service
// 프로젝트 owner 요청을 받아 "프로젝트 agent 확보 -> raw token 발급 -> 기존 연결 종료" 흐름을 조율한다.
public class ProjectAgentTokenIssueService {

  private static final CloseStatus TOKEN_REISSUED_CLOSE_STATUS =
      CloseStatus.NORMAL.withReason("Agent token reissued");

  private final ProjectAuthorizationService projectAuthorizationService;
  private final AgentRepository agentRepository;
  private final AgentTokenIssueService agentTokenIssueService;
  private final AgentSessionRegistry agentSessionRegistry;

  public ProjectAgentTokenIssueService(
      ProjectAuthorizationService projectAuthorizationService,
      AgentRepository agentRepository,
      AgentTokenIssueService agentTokenIssueService,
      AgentSessionRegistry agentSessionRegistry
  ) {
    this.projectAuthorizationService = projectAuthorizationService;
    this.agentRepository = agentRepository;
    this.agentTokenIssueService = agentTokenIssueService;
    this.agentSessionRegistry = agentSessionRegistry;
  }

  @Transactional
  public ProjectAgentTokenIssueResult issueToken(Long projectId, AuthenticatedActor actor) {
    // 토큰 재발급은 project 단위로 직렬화해 중복 발급/동시 생성 경쟁을 막는다.
    Project project = projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(projectId, actor);

    // project 기준 agent를 재사용하고, 없으면 placeholder agent를 만들어 토큰 발급 대상을 확보한다.
    Agent agent = loadOrCreateProjectAgent(project);
    String agentToken = agentTokenIssueService.issueToken(agent.getId());
    closeCurrentAgentSession(agent.getId());
    return new ProjectAgentTokenIssueResult(agent.getId(), project.getId(), agentToken);
  }

  private Agent loadOrCreateProjectAgent(Project project) {
    // Local Agent가 아직 연결되지 않았더라도 토큰 발급을 위해 placeholder agent를 먼저 만든다.
    return agentRepository.findFirstByProjectId(project.getId())
        .orElseGet(() -> agentRepository.save(new Agent(project, AgentStatus.OFFLINE, true)));
  }

  private void closeCurrentAgentSession(Long agentId) {
    // 토큰 재발급은 기존 인증을 즉시 무효화하므로 현재 WS 연결도 함께 종료한다.
    try {
      agentSessionRegistry.closeCurrentSession(agentId, TOKEN_REISSUED_CLOSE_STATUS);
    } catch (IOException ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
