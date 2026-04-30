package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

// 전체 스캔 히스토리 조회 API의 1차 응답 DTO다.
// 이후 커밋에서 페이지 정보와 요약 count가 붙더라도,
// 현재 커밋에서는 목록 API 자체를 여는 데 필요한 최소 형태만 유지한다.
public record HistoryScanListResponse(
    @ArraySchema(schema = @Schema(implementation = HistoryScanListItemResponse.class))
    List<HistoryScanListItemResponse> items
) {
}
