package com.ssafer.agent.api.dto;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import java.time.Instant;
import tools.jackson.databind.JsonNode;

public record PendingAgentTaskResponseData(
    Long taskId,
    AgentTaskType taskType,
    AgentTaskStatus taskStatus,
    Long projectId,
    Long scanId,
    Long findingId,
    JsonNode payload,
    Instant queuedAt
) {
}

