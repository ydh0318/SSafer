package com.ssafer.agent.application.service;

public record ProjectAgentTokenIssueResult(
    Long agentId,
    Long projectId,
    String agentToken
) {
}
