package com.ssafer.scan.api.dto;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record LocalAgentScanRequestResponseData(
    @Schema(description = "Created scan ID", example = "1002")
    Long scanId,

    @Schema(description = "Created AgentTask ID", example = "3001")
    Long agentTaskId,

    @Schema(description = "Created scan status", example = "REQUESTED")
    ScanStatus status,

    @Schema(description = "Created AgentTask status", example = "PENDING")
    AgentTaskStatus agentTaskStatus,

    @Schema(description = "TASK_AVAILABLE WebSocket notification delivery result", example = "true")
    boolean notificationSent
) {
}
