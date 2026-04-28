package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.media.Schema;

// 스캔 시작 API 성공 시 반환하는 응답 본문(data).
// 실제 값 계산은 서비스 계층에서 완료된 결과를 그대로 담는다.
public record CreateScanResponseData(
    @Schema(description = "생성된 스캔 ID", example = "1001")
    Long scanId,

    @Schema(description = "스캔이 속한 프로젝트 ID", example = "2001")
    Long projectId,

    @Schema(description = "현재 스캔 상태", example = "REQUESTED")
    ScanStatus status,

    @Schema(description = "원본 결과 파일 경로", example = "s3://ssafer/raw/1001/scan_result.json")
    String rawResultPath,

    @Schema(description = "원본 결과 업로드용 Presigned URL", example = "https://presigned-url.example.com")
    String rawUploadUrl
) {
}
