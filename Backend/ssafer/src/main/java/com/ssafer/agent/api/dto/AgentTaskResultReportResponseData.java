package com.ssafer.agent.api.dto;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.scan.domain.enums.ResolutionStatus;

public record AgentTaskResultReportResponseData(
    Long taskId,
    AgentTaskStatus taskStatus,
    Long findingId,
    ResolutionStatus resolutionStatus
) {
}
