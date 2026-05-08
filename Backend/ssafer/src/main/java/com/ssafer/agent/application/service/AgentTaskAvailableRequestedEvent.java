package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.enums.AgentTaskType;

public record AgentTaskAvailableRequestedEvent(
    Long agentId,
    Long taskId,
    AgentTaskType taskType,
    Long projectId,
    Long scanId,
    Long findingId
) {
}
