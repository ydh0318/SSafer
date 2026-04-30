package com.ssafer.agent.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.agent.api.dto.AgentStatusResponseData;
import com.ssafer.agent.application.service.AgentStatusQueryService;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.hamcrest.Matchers;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AgentStatusControllerTest {

  private MockMvc mockMvc;
  private CurrentActorProvider currentActorProvider;
  private AgentStatusQueryService agentStatusQueryService;

  @BeforeEach
  void setUp() {
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    agentStatusQueryService = Mockito.mock(AgentStatusQueryService.class);
    AgentStatusController controller = new AgentStatusController(currentActorProvider, agentStatusQueryService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  @Test
  void getAgentStatusReturnsOkWhenTaskExists() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(agentStatusQueryService.getAgentStatus(10L, actor))
        .willReturn(new AgentStatusResponseData(
            1L,
            AgentStatus.ONLINE,
            Instant.parse("2026-04-23T09:00:00Z"),
            Instant.parse("2026-04-23T09:05:00Z"),
            AgentTaskType.PATCH_APPLY
        ));

    mockMvc.perform(get("/api/v1/projects/10/agent/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("에이전트 상태 조회 성공"))
        .andExpect(jsonPath("$.data.agentId").value(1))
        .andExpect(jsonPath("$.data.status").value("ONLINE"))
        .andExpect(jsonPath("$.data.currentTaskType").value("PATCH_APPLY"));
  }

  @Test
  void getAgentStatusReturnsOkWhenTaskDoesNotExist() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(agentStatusQueryService.getAgentStatus(10L, actor))
        .willReturn(new AgentStatusResponseData(
            1L,
            AgentStatus.OFFLINE,
            null,
            Instant.parse("2026-04-23T09:05:00Z"),
            null
        ));

    mockMvc.perform(get("/api/v1/projects/10/agent/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentTaskType").value(Matchers.nullValue()));
  }

  @Test
  void getAgentStatusReturnsNotFoundWhenProjectOrAgentMissing() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(agentStatusQueryService.getAgentStatus(999L, actor))
        .willThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/projects/999/agent/status"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void getAgentStatusReturnsForbiddenWhenNotAllowed() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(agentStatusQueryService.getAgentStatus(10L, actor))
        .willThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(get("/api/v1/projects/10/agent/status"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void getAgentStatusReturnsUnauthorizedWhenUnauthenticated() throws Exception {
    given(currentActorProvider.getCurrentActor()).willThrow(new BusinessException(ErrorCode.UNAUTHORIZED));

    mockMvc.perform(get("/api/v1/projects/10/agent/status"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}
