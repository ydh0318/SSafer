package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.ws.AgentSessionRegistry;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.CloseStatus;

class ProjectAgentTokenIssueServiceTest {

  private ProjectAuthorizationService projectAuthorizationService;
  private AgentRepository agentRepository;
  private AgentTokenIssueService agentTokenIssueService;
  private AgentSessionRegistry agentSessionRegistry;
  private ProjectAgentTokenIssueService projectAgentTokenIssueService;

  @BeforeEach
  void setUp() {
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTokenIssueService = Mockito.mock(AgentTokenIssueService.class);
    agentSessionRegistry = Mockito.mock(AgentSessionRegistry.class);
    projectAgentTokenIssueService = new ProjectAgentTokenIssueService(
        projectAuthorizationService,
        agentRepository,
        agentTokenIssueService,
        agentSessionRegistry
    );
  }

  @Test
  void issueTokenReusesExistingProjectAgent() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = buildProject(10L);
    Agent agent = buildAgent(3L, project, false);
    given(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findFirstByProjectId(10L)).willReturn(Optional.of(agent));
    given(agentTokenIssueService.issueToken(3L)).willReturn("raw-agent-token");

    ProjectAgentTokenIssueResult result = projectAgentTokenIssueService.issueToken(10L, actor);

    verify(agentSessionRegistry).closeCurrentSession(any(Long.class), any(CloseStatus.class));
    assertThat(result.agentId()).isEqualTo(3L);
    assertThat(result.projectId()).isEqualTo(10L);
    assertThat(result.agentToken()).isEqualTo("raw-agent-token");
  }

  @Test
  void issueTokenCreatesPlaceholderAgentWhenProjectAgentMissing() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = buildProject(10L);
    Agent savedAgent = buildAgent(5L, project, true);
    given(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findFirstByProjectId(10L)).willReturn(Optional.empty());
    given(agentRepository.save(any(Agent.class))).willReturn(savedAgent);
    given(agentTokenIssueService.issueToken(5L)).willReturn("new-raw-token");

    ProjectAgentTokenIssueResult result = projectAgentTokenIssueService.issueToken(10L, actor);

    verify(agentRepository).save(any(Agent.class));
    verify(agentSessionRegistry).closeCurrentSession(any(Long.class), any(CloseStatus.class));
    assertThat(result.agentId()).isEqualTo(5L);
    assertThat(result.projectId()).isEqualTo(10L);
    assertThat(result.agentToken()).isEqualTo("new-raw-token");
  }

  private Project buildProject(Long projectId) {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Agent buildAgent(Long agentId, Project project, boolean placeholder) {
    Agent agent = new Agent(project, AgentStatus.OFFLINE, placeholder);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }
}
