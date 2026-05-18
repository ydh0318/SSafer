package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;

public record ScanFindingDetailResponse(
    @Schema(description = "취약점 결과 ID", example = "2001")
    Long findingId,
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "스캔 노드 ID", example = "3001")
    Long scanNodeId,
    @Schema(description = "취약점 출처", example = "TRIVY")
    FindingSourceType sourceType,
    @Schema(description = "중복 집계를 위한 지문", example = "sha256:abc123")
    String fingerprint,
    @Schema(description = "심각도", example = "HIGH")
    Severity severity,
    @Schema(description = "취약점 카테고리", example = "CONFIG")
    String category,
    @Schema(description = "취약점 제목", example = "Image user should not be 'root'")
    String title,
    @Schema(description = "취약점 설명")
    String description,
    @Schema(description = "가려진 원문 증거")
    String maskedEvidence,
    @Schema(description = "구조화된 설명")
    ScanFindingExplanationResponse explanation,
    @Schema(description = "현실 영향 설명")
    String impact,
    @Schema(description = "문제가 발생한 파일 경로", example = "Dockerfile")
    String filePath,
    @Schema(description = "문제가 발생한 줄 번호", example = "2")
    Integer lineNumber,
    @Schema(description = "관련 리소스 이름", example = "Dockerfile")
    String resourceName,
    @Schema(description = "취약점 규칙 코드", example = "DS-0002")
    String ruleCode,
    @Schema(description = "공격 시나리오 설명")
    String attackScenario,
    @Schema(description = "조치 가이드")
    String remediationGuide,
    @Schema(description = "구조화된 수정 가이드")
    ScanFindingFixResponse fix,
    @Schema(description = "보안 참고자료 목록")
    List<ScanFindingReferenceResponse> references,
    @Schema(description = "연관 파일 경로 목록")
    List<String> targetFiles,
    @Schema(description = "원본 결과 일부 JSON")
    String rawSnippetJson,
    @Schema(description = "패치 적용용 payload JSON")
    String patchPayloadJson,
    @Schema(description = "조치 상태", example = "OPEN")
    ResolutionStatus resolutionStatus,
    @Schema(description = "패치 승인 주체 유형", example = "USER")
    RequestActorType patchApprovedActorType,
    @Schema(description = "패치 승인 사용자 ID", example = "1")
    Long patchApprovedByUserId,
    @Schema(description = "패치 승인 시각", example = "2026-04-27T10:00:00")
    LocalDateTime patchApprovedAt,
    @Schema(description = "패치 결과 메시지")
    String patchResultMessage,
    @Schema(description = "백업 파일명", example = "Dockerfile.bak")
    String backupFileName,
    @Schema(description = "백업 파일 경로", example = "/backup/Dockerfile.bak")
    String backupFilePath,
    @Schema(description = "백업 메타데이터 JSON")
    String backupMetadataJson,
    @Schema(description = "패치 적용 시각", example = "2026-04-27T10:05:00")
    LocalDateTime patchedAt,
    @Schema(description = "취약점 생성 시각", example = "2026-04-27T09:30:00")
    LocalDateTime createdAt
) {
}
