package com.ssafer.scan.api.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record ScanFindingListResponseData(
    @ArraySchema(schema = @Schema(implementation = ScanFindingListItemResponse.class))
    List<ScanFindingListItemResponse> items,
    @Schema(description = "현재 페이지 번호", example = "0")
    int page,
    @Schema(description = "페이지 크기", example = "20")
    int size,
    @Schema(description = "전체 데이터 수", example = "42")
    long totalElements,
    @Schema(description = "전체 페이지 수", example = "3")
    int totalPages
) {
}
