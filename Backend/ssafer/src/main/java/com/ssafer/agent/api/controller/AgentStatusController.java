package com.ssafer.agent.api.controller;

import com.ssafer.agent.api.dto.AgentStatusResponseData;
import com.ssafer.agent.application.service.AgentStatusQueryService;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
@Tag(name = "에이전트 상태 조회", description = "프로젝트에 연결된 에이전트 상태를 조회하는 API")
public class AgentStatusController {

  private static final String GET_AGENT_STATUS_SUCCESS_MESSAGE = "에이전트 상태 조회 성공";

  private final CurrentActorProvider currentActorProvider;
  private final AgentStatusQueryService agentStatusQueryService;

  public AgentStatusController(
      CurrentActorProvider currentActorProvider,
      AgentStatusQueryService agentStatusQueryService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.agentStatusQueryService = agentStatusQueryService;
  }

  @GetMapping("/{projectId}/agent/status")
  @Operation(summary = "에이전트 상태 조회", description = "프로젝트에 연결된 단일 에이전트의 현재 연결 상태를 조회합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "에이전트 상태 조회 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "접근 권한이 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "프로젝트 또는 에이전트를 찾을 수 없음 (NOT_FOUND)")
  })
  public ResponseEntity<ApiResponse<AgentStatusResponseData>> getAgentStatus(
      @Parameter(description = "프로젝트 ID", example = "10")
      @PathVariable Long projectId
  ) {
    // 현재 요청 주체 권한 범위에서 프로젝트의 단일 agent 상태를 조회한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    AgentStatusResponseData data = agentStatusQueryService.getAgentStatus(projectId, actor);
    return ResponseEntity.ok(ApiResponse.success(GET_AGENT_STATUS_SUCCESS_MESSAGE, data));
  }
}

