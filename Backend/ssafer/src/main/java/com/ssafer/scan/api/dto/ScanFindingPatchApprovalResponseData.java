package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDateTime;

public record ScanFindingPatchApprovalResponseData(
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "취약점 결과 ID", example = "2001")
    Long findingId,
    @Schema(description = "생성된 에이전트 작업 ID", example = "3001")
    Long agentTaskId,
    @Schema(description = "패치 적용 대상 agent ID", example = "10")
    Long agentId,
    @Schema(description = "현재 취약점 처리 상태", example = "IN_PROGRESS")
    ResolutionStatus resolutionStatus,
    @Schema(description = "패치 승인 주체 유형", example = "USER")
    RequestActorType patchApprovedActorType,
    @Schema(description = "패치 승인 사용자 ID", example = "1")
    Long patchApprovedByUserId,
    @Schema(description = "패치 승인 시각", example = "2026-05-08T13:00:00")
    LocalDateTime patchApprovedAt,
    @Schema(description = "PATCH_APPLY task queued 시각", example = "2026-05-08T04:00:00Z")
    Instant queuedAt
) {
}
