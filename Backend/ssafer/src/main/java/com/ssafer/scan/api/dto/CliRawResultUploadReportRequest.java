package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

// CLI가 raw 파일 업로드 완료 후 서버에 전달하는 메타데이터.
public record CliRawResultUploadReportRequest(
    @Schema(description = "raw results를 생성한 도구명", example = "ssafer-cli")
    @Size(max = 100) String tool,
    @Schema(description = "도구 버전", example = "1.4.0")
    @Size(max = 50) String toolVersion,
    @Schema(description = "raw results 내 탐지 결과 개수", example = "152")
    @Min(0) Integer resultCount,
    @Schema(
        description = "중복 업로드 검증용 해시값 (sha256:{64자리 hex})",
        example = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    @Size(max = 80) String payloadHash
) {
}
