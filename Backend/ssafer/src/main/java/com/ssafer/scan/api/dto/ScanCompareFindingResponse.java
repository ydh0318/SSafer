package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.Severity;
import io.swagger.v3.oas.annotations.media.Schema;

// 결과 비교 화면에서 공통으로 보여주는 취약점 요약 응답이다.
public record ScanCompareFindingResponse(
    @Schema(description = "취약점 결과 ID", example = "2001")
    Long findingId,
    @Schema(description = "스캔 ID", example = "1001")
    Long scanId,
    @Schema(description = "동일 판단 기준으로 사용한 비교 키", example = "sha256:abc123")
    String comparisonKey,
    @Schema(description = "원본 fingerprint", example = "sha256:abc123")
    String fingerprint,
    @Schema(description = "소스 유형", example = "TRIVY")
    FindingSourceType sourceType,
    @Schema(description = "심각도", example = "HIGH")
    Severity severity,
    @Schema(description = "카테고리", example = "CONFIG")
    String category,
    @Schema(description = "취약점 제목", example = "Image user should not be 'root'")
    String title,
    @Schema(description = "파일 경로", example = "Dockerfile")
    String filePath,
    @Schema(description = "문제 발생 라인 번호", example = "12")
    Integer lineNumber,
    @Schema(description = "룰 코드", example = "DS-0002")
    String ruleCode
) {
}
