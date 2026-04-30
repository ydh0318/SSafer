package com.ssafer.agent.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.application.service.PendingAgentTaskQueryService;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AgentPrincipal;
import com.ssafer.global.security.CurrentAgentProvider;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

class InternalAgentTaskControllerTest {

  private MockMvc mockMvc;
  private CurrentAgentProvider currentAgentProvider;
  private PendingAgentTaskQueryService pendingAgentTaskQueryService;

  @BeforeEach
  void setUp() {
    currentAgentProvider = Mockito.mock(CurrentAgentProvider.class);
    pendingAgentTaskQueryService = Mockito.mock(PendingAgentTaskQueryService.class);
    InternalAgentTaskController controller = new InternalAgentTaskController(
        currentAgentProvider,
        pendingAgentTaskQueryService
    );
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  @Test
  void getPendingTasksReturnsOk() throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    given(currentAgentProvider.getCurrentAgent()).willReturn(AgentPrincipal.of(1L));
    given(pendingAgentTaskQueryService.getPendingTasks(1L, 1L))
        .willReturn(List.of(
            new PendingAgentTaskResponseData(
                101L,
                AgentTaskType.PATCH_APPLY,
                AgentTaskStatus.PENDING,
                10L,
                55L,
                312L,
                objectMapper.readTree("{\"action\":\"UPDATE_CONFIG\"}"),
                Instant.parse("2026-04-23T09:00:00Z")
            )
        ));

    mockMvc.perform(get("/api/v1/internal/agents/1/tasks"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("미처리 task 조회 성공"))
        .andExpect(jsonPath("$.data[0].taskId").value(101))
        .andExpect(jsonPath("$.data[0].taskStatus").value("PENDING"));
  }

  @Test
  void getPendingTasksReturnsNotFound() throws Exception {
    given(currentAgentProvider.getCurrentAgent()).willReturn(AgentPrincipal.of(1L));
    given(pendingAgentTaskQueryService.getPendingTasks(999L, 1L))
        .willThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/internal/agents/999/tasks"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void getPendingTasksReturnsForbidden() throws Exception {
    given(currentAgentProvider.getCurrentAgent()).willReturn(AgentPrincipal.of(1L));
    given(pendingAgentTaskQueryService.getPendingTasks(2L, 1L))
        .willThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(get("/api/v1/internal/agents/2/tasks"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void getPendingTasksReturnsUnauthorized() throws Exception {
    given(currentAgentProvider.getCurrentAgent()).willThrow(new BusinessException(ErrorCode.UNAUTHORIZED));

    mockMvc.perform(get("/api/v1/internal/agents/1/tasks"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}

