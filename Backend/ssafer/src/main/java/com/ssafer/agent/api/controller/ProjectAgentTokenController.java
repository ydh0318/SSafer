package com.ssafer.agent.api.controller;

import com.ssafer.agent.api.dto.AgentTokenIssueResponseData;
import com.ssafer.agent.application.service.ProjectAgentTokenIssueResult;
import com.ssafer.agent.application.service.ProjectAgentTokenIssueService;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
@Tag(name = "에이전트 토큰 발급", description = "프로젝트 Local Agent 인증 토큰 발급 API")
public class ProjectAgentTokenController {

  private static final String ISSUE_AGENT_TOKEN_SUCCESS_MESSAGE = "에이전트 토큰 발급 성공";

  private final CurrentActorProvider currentActorProvider;
  private final ProjectAgentTokenIssueService projectAgentTokenIssueService;

  public ProjectAgentTokenController(
      CurrentActorProvider currentActorProvider,
      ProjectAgentTokenIssueService projectAgentTokenIssueService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.projectAgentTokenIssueService = projectAgentTokenIssueService;
  }

  @PostMapping("/{projectId}/agent/token")
  @Operation(
      summary = "프로젝트 Agent 토큰 발급",
      description = "프로젝트 소유자가 Local Agent 인증용 토큰을 발급합니다. "
          + "토큰을 재발급하면 기존 Local Agent 연결은 종료되며, 새 토큰으로 다시 연결해야 합니다."
  )
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "에이전트 토큰 발급 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "프로젝트 접근 권한 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "프로젝트를 찾을 수 없음 (NOT_FOUND)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<AgentTokenIssueResponseData>> issueAgentToken(
      @Parameter(description = "프로젝트 ID", example = "10")
      @PathVariable Long projectId
  ) {
    // 요청 사용자가 프로젝트 owner인지 확인한 뒤 agent 토큰을 발급한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    ProjectAgentTokenIssueResult result = projectAgentTokenIssueService.issueToken(projectId, actor);
    AgentTokenIssueResponseData data = new AgentTokenIssueResponseData(
        result.agentId(),
        result.projectId(),
        result.agentToken()
    );
    return ResponseEntity.ok(ApiResponse.success(ISSUE_AGENT_TOKEN_SUCCESS_MESSAGE, data));
  }
}
