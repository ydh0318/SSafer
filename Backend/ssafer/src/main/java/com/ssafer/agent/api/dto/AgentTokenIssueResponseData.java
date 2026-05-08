package com.ssafer.agent.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record AgentTokenIssueResponseData(
    @Schema(description = "에이전트 ID", example = "3")
    Long agentId,
    @Schema(description = "프로젝트 ID", example = "10")
    Long projectId,
    @Schema(description = "에이전트 인증 토큰 원문. 발급 응답에서만 한 번 반환됩니다.", example = "raw-agent-token")
    String agentToken
) {
}
