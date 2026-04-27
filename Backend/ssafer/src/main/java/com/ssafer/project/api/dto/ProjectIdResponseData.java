package com.ssafer.project.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ProjectIdResponseData(
    @Schema(description = "프로젝트 ID", example = "101")
    Long projectId
) {
}
