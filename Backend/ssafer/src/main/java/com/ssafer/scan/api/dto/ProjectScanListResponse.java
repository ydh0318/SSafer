package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

// 프로젝트별 스캔 목록 조회 API 응답 래퍼 DTO.
public record ProjectScanListResponse(
    @ArraySchema(schema = @Schema(implementation = ProjectScanListItemResponse.class))
    List<ProjectScanListItemResponse> items,
    @Schema(description = "현재 페이지 번호", example = "0")
    int page,
    @Schema(description = "페이지 크기", example = "20")
    int size,
    @Schema(description = "전체 데이터 수", example = "1")
    long totalElements,
    @Schema(description = "전체 페이지 수", example = "1")
    int totalPages
) {
}
