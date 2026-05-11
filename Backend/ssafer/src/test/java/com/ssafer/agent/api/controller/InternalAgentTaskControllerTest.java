package com.ssafer.agent.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.agent.api.dto.AgentTaskResultReportRequest;
import com.ssafer.agent.api.dto.AgentTaskResultReportResponseData;
import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.application.service.AgentTaskResultReportService;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;
import com.ssafer.scan.domain.enums.ResolutionStatus;

class InternalAgentTaskControllerTest {

  private MockMvc mockMvc;
  private CurrentAgentProvider currentAgentProvider;
  private PendingAgentTaskQueryService pendingAgentTaskQueryService;
  private AgentTaskResultReportService agentTaskResultReportService;

  @BeforeEach
  void setUp() {
    currentAgentProvider = Mockito.mock(CurrentAgentProvider.class);
    pendingAgentTaskQueryService = Mockito.mock(PendingAgentTaskQueryService.class);
    agentTaskResultReportService = Mockito.mock(AgentTaskResultReportService.class);
    InternalAgentTaskController controller = new InternalAgentTaskController(
        currentAgentProvider,
        pendingAgentTaskQueryService,
        agentTaskResultReportService
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

  @Test
  void reportTaskResultReturnsOk() throws Exception {
    given(currentAgentProvider.getCurrentAgent()).willReturn(AgentPrincipal.of(1L));
    given(agentTaskResultReportService.reportResult(
        Mockito.eq(1L),
        Mockito.eq(1L),
        Mockito.eq(10L),
        Mockito.any(AgentTaskResultReportRequest.class)
    )).willReturn(new AgentTaskResultReportResponseData(
        10L,
        AgentTaskStatus.SUCCEEDED,
        100L,
        ResolutionStatus.RESOLVED
    ));

    mockMvc.perform(post("/api/v1/internal/agents/1/tasks/10/result")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "taskStatus": "SUCCEEDED",
                  "resultMessage": "Applied 1 patch candidate(s).",
                  "patchResults": [
                    {
                      "patchId": "PATCH-FND-0001",
                      "filePath": "Dockerfile",
                      "status": "SUCCESS",
                      "message": "Patch applied successfully.",
                      "backupPath": ".ssafer/backups/Dockerfile.20260507120000.bak"
                    }
                  ]
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.taskId").value(10))
        .andExpect(jsonPath("$.data.taskStatus").value("SUCCEEDED"))
        .andExpect(jsonPath("$.data.findingId").value(100))
        .andExpect(jsonPath("$.data.resolutionStatus").value("RESOLVED"));
  }
}

