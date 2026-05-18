package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ScanFindingReferenceResponse(
    @Schema(description = "참고자료 제목", example = "CVE-2024-21626 - NVD")
    String title,
    @Schema(description = "참고자료 URL", example = "https://nvd.nist.gov/vuln/detail/CVE-2024-21626")
    String url,
    @Schema(description = "참고자료 요약", example = "A container escape vulnerability...")
    String snippet
) {
}
