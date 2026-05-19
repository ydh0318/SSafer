package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.FindingResolutionStatusUpdateRequest;
import com.ssafer.scan.api.dto.FindingResolutionStatusUpdateResponseData;
import com.ssafer.scan.application.service.FindingResolutionStatusUpdateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/findings")
@RequiredArgsConstructor
@Tag(name = "Finding 상태 관리", description = "Finding 조치 상태를 수동으로 변경하는 API")
public class FindingResolutionStatusController {

  private static final String UPDATE_RESOLUTION_STATUS_SUCCESS_MESSAGE = "Finding 조치 상태 변경 성공";

  private final FindingResolutionStatusUpdateService findingResolutionStatusUpdateService;

  @PatchMapping("/{findingId}/resolution-status")
  @Operation(
      summary = "Finding 조치 상태 수동 변경",
      description = "접근 가능한 프로젝트의 finding 조치 상태를 OPEN, IN_PROGRESS, RESOLVED, IGNORED 중 하나로 변경합니다."
  )
  public ResponseEntity<ApiResponse<FindingResolutionStatusUpdateResponseData>> updateResolutionStatus(
      @Parameter(description = "finding ID", example = "2001")
      @PathVariable Long findingId,
      @Valid @RequestBody FindingResolutionStatusUpdateRequest request
  ) {
    FindingResolutionStatusUpdateResponseData data = findingResolutionStatusUpdateService.updateStatus(
        findingId,
        request.status()
    );
    return ResponseEntity.ok(ApiResponse.success(UPDATE_RESOLUTION_STATUS_SUCCESS_MESSAGE, data));
  }
}
