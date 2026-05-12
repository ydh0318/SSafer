package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record ScanFindingFixResponse(
    @Schema(description = "수정 요약")
    String summary,
    @Schema(description = "수정 우선순위", example = "high")
    String priority,
    @Schema(description = "권장 조치 목록")
    List<String> recommendedActions,
    @Schema(description = "코드/설정 변경 가이드")
    String codeGuidance,
    @Schema(description = "검증 방법")
    String verification,
    @Schema(description = "주의사항 목록")
    List<String> cautions,
    @Schema(description = "자동 적용 가능 패치 목록")
    List<ScanFindingFixPatchResponse> patches
) {
}
