package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

// 전체 스캔 히스토리 조회 API의 응답 DTO다.
// 상단 summary는 현재 필터 전체 결과를 기준으로, items는 현재 페이지 데이터만 담는다.
public record HistoryScanListResponse(
    @Schema(description = "히스토리 전체 요약 정보")
    HistoryScanSummaryCountResponse summary,
    @ArraySchema(schema = @Schema(implementation = HistoryScanListItemResponse.class))
    List<HistoryScanListItemResponse> items,
    @Schema(description = "현재 페이지 번호", example = "0")
    int page,
    @Schema(description = "페이지 크기", example = "20")
    int size,
    @Schema(description = "현재 필터 기준 전체 데이터 수", example = "25")
    long totalElements,
    @Schema(description = "현재 필터 기준 전체 페이지 수", example = "2")
    int totalPages
) {
}
