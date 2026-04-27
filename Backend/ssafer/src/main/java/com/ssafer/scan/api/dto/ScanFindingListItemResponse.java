package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record ScanFindingListItemResponse(
    @Schema(description = "취약점 결과 ID", example = "2001")
    Long findingId,
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "스캔 노드 ID", example = "3001")
    Long scanNodeId,
    @Schema(description = "탐지 출처", example = "TRIVY")
    FindingSourceType sourceType,
    @Schema(description = "심각도", example = "HIGH")
    Severity severity,
    @Schema(description = "취약점 카테고리", example = "CONFIG")
    String category,
    @Schema(description = "취약점 제목", example = "Image user should not be 'root'")
    String title,
    @Schema(description = "문제가 발생한 파일 경로", example = "Dockerfile")
    String filePath,
    @Schema(description = "문제가 발생한 줄 번호", example = "12")
    Integer lineNumber,
    @Schema(description = "관련 리소스 이름", example = "Dockerfile")
    String resourceName,
    @Schema(description = "탐지 규칙 코드", example = "DS-0002")
    String ruleCode,
    @Schema(description = "조치 상태", example = "OPEN")
    ResolutionStatus resolutionStatus,
    @Schema(description = "취약점 생성 시각", example = "2026-04-27T09:30:00")
    LocalDateTime createdAt
) {
}
