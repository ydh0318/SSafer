package com.ssafer.scan.api.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.LocalAgentScanRequest;
import com.ssafer.scan.api.dto.LocalAgentScanRequestResponseData;
import com.ssafer.scan.application.service.LocalAgentScanRequestService;
import com.ssafer.scan.domain.enums.ScanStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class LocalAgentScanRequestControllerTest {

  private MockMvc mockMvc;
  private CurrentActorProvider currentActorProvider;
  private LocalAgentScanRequestService localAgentScanRequestService;

  @BeforeEach
  void setUp() {
    currentActorProvider = Mockito.mock(CurrentActorProvider.class);
    localAgentScanRequestService = Mockito.mock(LocalAgentScanRequestService.class);
    LocalAgentScanRequestController controller =
        new LocalAgentScanRequestController(currentActorProvider, localAgentScanRequestService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  @Test
  void requestScanReturnsOkResponse() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(localAgentScanRequestService.requestScan(
        Mockito.eq(10L),
        Mockito.eq(actor),
        Mockito.any(LocalAgentScanRequest.class)
    )).willReturn(new LocalAgentScanRequestResponseData(
        1002L,
        3001L,
        ScanStatus.REQUESTED,
        AgentTaskStatus.PENDING,
        true
    ));

    mockMvc.perform(post("/api/v1/projects/10/scans/agent")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "targetPath": "/opt/app",
                  "scanName": "운영 서버 점검",
                  "includeLogs": false
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Local Agent 기반 점검 요청 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1002))
        .andExpect(jsonPath("$.data.agentTaskId").value(3001))
        .andExpect(jsonPath("$.data.status").value("REQUESTED"))
        .andExpect(jsonPath("$.data.agentTaskStatus").value("PENDING"))
        .andExpect(jsonPath("$.data.notificationSent").value(true));
  }

  @Test
  void requestScanWhenTargetPathMissingReturnsBadRequest() throws Exception {
    mockMvc.perform(post("/api/v1/projects/10/scans/agent")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "scanName": "운영 서버 점검",
                  "includeLogs": false
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  @Test
  void requestScanWhenAgentOfflineReturnsConflict() throws Exception {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    given(currentActorProvider.getCurrentActor()).willReturn(actor);
    given(localAgentScanRequestService.requestScan(
        Mockito.eq(10L),
        Mockito.eq(actor),
        Mockito.any(LocalAgentScanRequest.class)
    )).willThrow(new BusinessException(ErrorCode.AGENT_OFFLINE));

    mockMvc.perform(post("/api/v1/projects/10/scans/agent")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "targetPath": "/opt/app"
                }
                """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("AGENT_OFFLINE"));
  }
}
