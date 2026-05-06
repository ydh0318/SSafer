package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

// 결과 비교 API 응답 DTO다.
// 기본 메타데이터와 비교 summary, 분류 결과를 함께 반환한다.
public record ScanCompareResponse(
    @Schema(description = "비교 기준 스캔 ID", example = "1001")
    Long baseScanId,
    @Schema(description = "비교 대상 스캔 ID", example = "1002")
    Long targetScanId,
    @Schema(description = "비교 대상 프로젝트 ID", example = "101")
    Long projectId,
    @Schema(description = "기준 스캔 상태", example = "DONE")
    ScanStatus baseStatus,
    @Schema(description = "대상 스캔 상태", example = "DONE")
    ScanStatus targetStatus,
    @Schema(description = "비교 결과 요약")
    ScanCompareSummaryResponse summary,
    @Schema(description = "대상 스캔에서 새로 발생한 취약점 목록")
    List<ScanCompareFindingResponse> newFindings,
    @Schema(description = "기준 스캔 대비 해결된 취약점 목록")
    List<ScanCompareFindingResponse> resolvedFindings,
    @Schema(description = "심각도 변화 없이 유지된 취약점 목록")
    List<ScanCompareFindingResponse> retainedFindings,
    @Schema(description = "심각도가 변경된 취약점 목록")
    List<ScanCompareSeverityChangedFindingResponse> severityChangedFindings
) {
}
