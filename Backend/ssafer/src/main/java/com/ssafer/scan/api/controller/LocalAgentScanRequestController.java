package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.LocalAgentScanRequest;
import com.ssafer.scan.api.dto.LocalAgentScanRequestResponseData;
import com.ssafer.scan.application.service.LocalAgentScanRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Local Agent scan request", description = "Local Agent based scan request API")
@RestController
@RequestMapping("/api/v1/projects/{projectId}/scans/agent")
@RequiredArgsConstructor
// 웹에서 특정 프로젝트의 Local Agent에게 점검 작업을 요청하는 진입점이다.
// 실제 scan/task 생성과 알림 처리는 서비스 계층에 위임한다.
public class LocalAgentScanRequestController {

  private static final String REQUEST_LOCAL_AGENT_SCAN_SUCCESS_MESSAGE = "Local Agent 기반 점검 요청 성공";

  private final CurrentActorProvider currentActorProvider;
  private final LocalAgentScanRequestService localAgentScanRequestService;

  @PostMapping
  @Operation(
      summary = "Local Agent 기반 점검 요청",
      description = "프로젝트에 연결된 ONLINE Local Agent에게 SCAN_REQUEST task를 생성합니다.")
  public ResponseEntity<ApiResponse<LocalAgentScanRequestResponseData>> requestScan(
      @PathVariable Long projectId,
      @Valid @RequestBody LocalAgentScanRequest request
  ) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    LocalAgentScanRequestResponseData data = localAgentScanRequestService.requestScan(projectId, actor, request);
    return ResponseEntity.ok(ApiResponse.success(REQUEST_LOCAL_AGENT_SCAN_SUCCESS_MESSAGE, data));
  }
}
