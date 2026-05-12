package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ScanFindingFixPatchResponse(
    @Schema(description = "패치 ID", example = "PATCH-FND-0001")
    String patchId,
    @Schema(description = "대상 finding 식별자", example = "FND-0001")
    String findingId,
    @Schema(description = "패치 연산 종류", example = "replace")
    String operation,
    @Schema(description = "대상 파일 경로", example = "docker-compose.yml")
    String filePath,
    @Schema(description = "교체 전 원문")
    String oldText,
    @Schema(description = "교체 후 원문")
    String newText,
    @Schema(description = "예상 파일 해시", example = "sha256:abc123")
    String expectedFileHash
) {
}
