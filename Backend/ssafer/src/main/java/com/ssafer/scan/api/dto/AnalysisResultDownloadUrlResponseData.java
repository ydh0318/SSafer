package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record AnalysisResultDownloadUrlResponseData(
    @Schema(description = "S3에 저장된 분석 결과 파일 경로", example = "s3://ssafer/analysis/1001/analysis_result.json")
    String analysisResultPath,
    @Schema(description = "분석 결과 파일 다운로드용 Presigned URL", example = "https://presigned-url.example.com")
    String downloadUrl,
    @Schema(description = "Presigned URL 만료 시간(초)", example = "600")
    long expiresInSeconds
) {
}
