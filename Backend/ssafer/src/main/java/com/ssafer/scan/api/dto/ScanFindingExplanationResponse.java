package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ScanFindingExplanationResponse(
    @Schema(description = "취약점 요약")
    String summary,
    @Schema(description = "위험한 이유")
    String whyRisky,
    @Schema(description = "악용 가능 시나리오")
    String abuseScenario,
    @Schema(description = "예상 영향")
    String expectedImpact,
    @Schema(description = "심각도 해석")
    String severityInterpretation
) {
}
