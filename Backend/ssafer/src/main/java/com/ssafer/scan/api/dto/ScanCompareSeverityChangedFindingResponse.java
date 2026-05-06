package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.Severity;
import io.swagger.v3.oas.annotations.media.Schema;

// 심각도 변경은 기준 스캔과 대상 스캔의 severity를 같이 보여준다.
public record ScanCompareSeverityChangedFindingResponse(
    @Schema(description = "기준 스캔 취약점 정보")
    ScanCompareFindingResponse baseFinding,
    @Schema(description = "대상 스캔 취약점 정보")
    ScanCompareFindingResponse targetFinding,
    @Schema(description = "기준 스캔 심각도", example = "HIGH")
    Severity baseSeverity,
    @Schema(description = "대상 스캔 심각도", example = "LOW")
    Severity targetSeverity
) {
}
