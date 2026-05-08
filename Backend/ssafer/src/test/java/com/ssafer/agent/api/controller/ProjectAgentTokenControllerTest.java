package com.ssafer.agent.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.agent.application.service.ProjectAgentTokenIssueResult;
import com.ssafer.agent.application.service.ProjectAgentTokenIssueService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ProjectAgentTokenControllerTest {

  private MockMvc mockMvc;
  private CurrentActorProvider currentActorProvider;
  private ProjectAgentTokenIssueService projectAgentTokenIssueService;

  @BeforeEach
  void setUp() {
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    projectAgentTokenIssueService = Mockito.mock(ProjectAgentTokenIssueService.class);
    ProjectAgentTokenController controller = new ProjectAgentTokenController(
        currentActorProvider,
        projectAgentTokenIssueService
    );
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  @Test
  void issueAgentTokenReturnsOk() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(projectAgentTokenIssueService.issueToken(10L, actor))
        .willReturn(new ProjectAgentTokenIssueResult(3L, 10L, "raw-agent-token"));

    mockMvc.perform(post("/api/v1/projects/10/agent/token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("에이전트 토큰 발급 성공"))
        .andExpect(jsonPath("$.data.agentId").value(3))
        .andExpect(jsonPath("$.data.projectId").value(10))
        .andExpect(jsonPath("$.data.agentToken").value("raw-agent-token"));
  }

  @Test
  void issueAgentTokenReturnsNotFound() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(projectAgentTokenIssueService.issueToken(999L, actor))
        .willThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(post("/api/v1/projects/999/agent/token"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void issueAgentTokenReturnsForbidden() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(projectAgentTokenIssueService.issueToken(10L, actor))
        .willThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(post("/api/v1/projects/10/agent/token"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void issueAgentTokenReturnsUnauthorized() throws Exception {
    given(currentActorProvider.getCurrentActor()).willThrow(new BusinessException(ErrorCode.UNAUTHORIZED));

    mockMvc.perform(post("/api/v1/projects/10/agent/token"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}
