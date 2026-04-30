package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.application.service.HistoryScanQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/history")
@RequiredArgsConstructor
@Tag(name = "히스토리", description = "회원의 전체 스캔 히스토리 조회 API")
public class HistoryScanQueryController {

  private static final String GET_HISTORY_SCANS_SUCCESS_MESSAGE = "전체 스캔 히스토리 조회 성공";

  private final HistoryScanQueryService historyScanQueryService;

  @GetMapping("/scans")
  @Operation(
      summary = "전체 스캔 히스토리 조회",
      description = "현재 로그인한 회원이 요청한 전체 스캔 히스토리 목록과 위험도 요약 정보를 조회합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "전체 스캔 히스토리 조회 성공"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "게스트 계정은 회원 히스토리에 접근할 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<HistoryScanListResponse>> getCurrentUserScanHistory() {
    // 컨트롤러는 HTTP 요청과 응답만 담당하고,
    // 실제 조회 대상 결정과 권한 판단은 서비스에 위임한다.
    HistoryScanListResponse data = historyScanQueryService.getCurrentUserScanHistory();
    return ResponseEntity.ok(ApiResponse.success(GET_HISTORY_SCANS_SUCCESS_MESSAGE, data));
  }
}
