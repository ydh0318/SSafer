package com.ssafer.agent.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.ws.AgentSessionRegistry;
import com.ssafer.agent.ws.AgentWebSocketHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.AgentTokenRegistry;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.ObjectMapper;

class ProjectAgentTokenSessionClosureTest {

  private ProjectAuthorizationService projectAuthorizationService;
  private AgentRepository agentRepository;
  private AgentTokenIssueService agentTokenIssueService;
  private AgentConnectionService agentConnectionService;
  private AgentSessionRegistry agentSessionRegistry;
  private ProjectAgentTokenIssueService projectAgentTokenIssueService;
  private AgentWebSocketHandler agentWebSocketHandler;

  @BeforeEach
  void setUp() {
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTokenIssueService = Mockito.mock(AgentTokenIssueService.class);
    agentConnectionService = Mockito.mock(AgentConnectionService.class);
    agentSessionRegistry = new AgentSessionRegistry();
    agentWebSocketHandler = new AgentWebSocketHandler(
        new ObjectMapper(),
        agentConnectionService,
        agentSessionRegistry,
        Mockito.mock(AgentTokenRegistry.class)
    );
    projectAgentTokenIssueService = new ProjectAgentTokenIssueService(
        projectAuthorizationService,
        agentRepository,
        agentTokenIssueService,
        agentSessionRegistry
    );
  }

  @Test
  void issueTokenClosesCurrentSessionAndTriggersOfflineTransition() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Project project = buildProject(10L);
    Agent agent = buildAgent(3L, project);
    WebSocketSession session = mockSessionThatInvokesAfterConnectionClosed("session-1");

    given(projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(10L, actor)).willReturn(project);
    given(agentRepository.findFirstByProjectId(10L)).willReturn(java.util.Optional.of(agent));
    given(agentTokenIssueService.issueToken(3L)).willReturn("reissued-token");
    agentSessionRegistry.register(agent.getId(), session);

    projectAgentTokenIssueService.issueToken(10L, actor);

    ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
    verify(agentConnectionService).markOffline(eq(3L), nowCaptor.capture());
  }

  private WebSocketSession mockSessionThatInvokesAfterConnectionClosed(String sessionId) throws Exception {
    WebSocketSession session = Mockito.mock(WebSocketSession.class);
    AtomicBoolean open = new AtomicBoolean(true);
    given(session.getId()).willReturn(sessionId);
    given(session.isOpen()).willAnswer(invocation -> open.get());
    doAnswer(invocation -> {
      CloseStatus closeStatus = invocation.getArgument(0);
      open.set(false);
      agentWebSocketHandler.afterConnectionClosed(session, closeStatus);
      return null;
    }).when(session).close(any(CloseStatus.class));
    return session;
  }

  private Project buildProject(Long projectId) {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", projectId);
    return project;
  }

  private Agent buildAgent(Long agentId, Project project) {
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }
}
