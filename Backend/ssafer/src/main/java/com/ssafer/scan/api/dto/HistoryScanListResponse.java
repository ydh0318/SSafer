package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

// 전체 스캔 히스토리 조회 API의 응답 DTO다.
// 상단 요약 영역에서 쓸 summary와, 목록 렌더링에 바로 쓸 item 리스트를 함께 내려준다.
public record HistoryScanListResponse(
    @Schema(description = "히스토리 전체 요약 정보")
    HistoryScanSummaryCountResponse summary,
    @ArraySchema(schema = @Schema(implementation = HistoryScanListItemResponse.class))
    List<HistoryScanListItemResponse> items
) {
}
