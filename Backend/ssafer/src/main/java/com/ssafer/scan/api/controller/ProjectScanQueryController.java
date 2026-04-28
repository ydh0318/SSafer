package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ProjectScanListResponse;
import com.ssafer.scan.application.service.ProjectScanListQueryService;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
@Tag(name = "프로젝트별 스캔 조회", description = "프로젝트의 스캔 이력을 조회하는 API")
public class ProjectScanQueryController {

  private static final String GET_PROJECT_SCANS_SUCCESS_MESSAGE = "스캔 목록 조회 성공";

  private final ProjectScanListQueryService projectScanListQueryService;

  @GetMapping("/{projectId}/scans")
  @Operation(summary = "프로젝트별 스캔 목록 조회", description = "프로젝트의 스캔 이력을 조회합니다.")
  public ResponseEntity<ApiResponse<ProjectScanListResponse>> getProjectScans(
      @Parameter(description = "프로젝트 ID", example = "101")
      @PathVariable Long projectId,
      @RequestParam(defaultValue = "0") Integer page,
      @RequestParam(defaultValue = "20") Integer size,
      @RequestParam(required = false) ScanStatus status,
      @RequestParam(required = false) ScanMode scanMode
  ) {
    // 필터/페이징/권한 검증은 서비스에 위임하고, 컨트롤러는 요청/응답 입출력에 집중한다.
    ProjectScanListResponse data = projectScanListQueryService.getProjectScans(
        projectId, page, size, status, scanMode
    );
    return ResponseEntity.ok(ApiResponse.success(GET_PROJECT_SCANS_SUCCESS_MESSAGE, data));
  }
}
