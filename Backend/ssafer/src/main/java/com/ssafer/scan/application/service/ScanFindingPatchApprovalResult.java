package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import java.time.Instant;
import java.time.LocalDateTime;

public record ScanFindingPatchApprovalResult(
    Long scanId,
    Long findingId,
    Long agentTaskId,
    Long agentId,
    ResolutionStatus resolutionStatus,
    RequestActorType patchApprovedActorType,
    Long patchApprovedByUserId,
    LocalDateTime patchApprovedAt,
    Instant queuedAt
) {
}
