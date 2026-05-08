package com.ssafer.agent.api.controller;

import com.ssafer.agent.api.dto.PendingAgentTaskResponseData;
import com.ssafer.agent.application.service.PendingAgentTaskQueryService;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AgentPrincipal;
import com.ssafer.global.security.CurrentAgentProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/internal/agents")
@Tag(name = "에이전트 작업 가져오기", description = "에이전트가 아직 가져가지 않은 작업을 조회하는 API")
public class InternalAgentTaskController {

  private static final String GET_PENDING_TASKS_SUCCESS_MESSAGE = "미처리 task 조회 성공";

  private final CurrentAgentProvider currentAgentProvider;
  private final PendingAgentTaskQueryService pendingAgentTaskQueryService;

  public InternalAgentTaskController(
      CurrentAgentProvider currentAgentProvider,
      PendingAgentTaskQueryService pendingAgentTaskQueryService
  ) {
    this.currentAgentProvider = currentAgentProvider;
    this.pendingAgentTaskQueryService = pendingAgentTaskQueryService;
  }

  @GetMapping("/{agentId}/tasks")
  @Operation(summary = "미처리 Agent Task 조회", description = "연결된 Agent가 아직 가져가지 않은 PENDING 작업을 오래된 순서로 조회하며, 반환 직전에 상태를 SENT로 전이합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "미처리 task 조회 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "에이전트 인증 정보가 없거나 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "요청 Agent와 token 매핑이 다름 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "대상 Agent가 존재하지 않음 (NOT_FOUND)")
  })
  public ResponseEntity<ApiResponse<List<PendingAgentTaskResponseData>>> getPendingTasks(
      @Parameter(description = "에이전트 ID", example = "1")
      @PathVariable Long agentId
  ) {
    AgentPrincipal currentAgent = currentAgentProvider.getCurrentAgent();
    List<PendingAgentTaskResponseData> data = pendingAgentTaskQueryService.getPendingTasks(
        agentId,
        currentAgent.agentId()
    );
    return ResponseEntity.ok(ApiResponse.success(GET_PENDING_TASKS_SUCCESS_MESSAGE, data));
  }
}
