package com.ssafer.agent.api.dto;

import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import java.time.Instant;

public record AgentStatusResponseData(
    Long agentId,
    AgentStatus status,
    Instant connectedAt,
    Instant lastSeenAt,
    AgentTaskType currentTaskType
) {
}

