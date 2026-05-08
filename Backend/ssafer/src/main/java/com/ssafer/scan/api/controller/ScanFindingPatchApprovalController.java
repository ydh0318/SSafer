package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.ScanFindingPatchApprovalResponseData;
import com.ssafer.scan.application.service.ScanFindingPatchApprovalResult;
import com.ssafer.scan.application.service.ScanFindingPatchApprovalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/scans")
@Tag(name = "취약점 패치 승인", description = "취약점 패치 승인과 PATCH_APPLY task 생성을 처리하는 API")
public class ScanFindingPatchApprovalController {

  private static final String APPROVE_PATCH_SUCCESS_MESSAGE = "취약점 패치 승인 성공";

  private final ScanFindingPatchApprovalService scanFindingPatchApprovalService;

  public ScanFindingPatchApprovalController(ScanFindingPatchApprovalService scanFindingPatchApprovalService) {
    this.scanFindingPatchApprovalService = scanFindingPatchApprovalService;
  }

  @PostMapping("/{scanId}/findings/{findingId}/approve")
  @Operation(
      summary = "취약점 패치 승인",
      description = "패치 payload가 있는 취약점 결과를 승인하고 PATCH_APPLY agent task를 생성합니다."
  )
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "패치 승인 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "프로젝트 접근 권한 없음"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "스캔 또는 취약점 결과를 찾을 수 없음"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "패치 payload가 없거나 현재 상태에서 승인 불가")
  })
  public ResponseEntity<ApiResponse<ScanFindingPatchApprovalResponseData>> approvePatch(
      @Parameter(description = "스캔 ID", example = "1001")
      @PathVariable Long scanId,
      @Parameter(description = "취약점 결과 ID", example = "2001")
      @PathVariable Long findingId
  ) {
    ScanFindingPatchApprovalResult result = scanFindingPatchApprovalService.approve(scanId, findingId);
    ScanFindingPatchApprovalResponseData data = new ScanFindingPatchApprovalResponseData(
        result.scanId(),
        result.findingId(),
        result.agentTaskId(),
        result.agentId(),
        result.resolutionStatus(),
        result.patchApprovedActorType(),
        result.patchApprovedByUserId(),
        result.patchApprovedAt(),
        result.queuedAt()
    );
    return ResponseEntity.ok(ApiResponse.success(APPROVE_PATCH_SUCCESS_MESSAGE, data));
  }
}
