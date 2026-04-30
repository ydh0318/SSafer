package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.application.service.HistoryScanQueryService;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
      description = "현재 로그인한 회원이 접근 가능한 프로젝트 범위에서 스캔 히스토리 목록과 위험도 요약 정보를 조회합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "전체 스캔 히스토리 조회 성공"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "페이지 또는 필터 파라미터 형식이 올바르지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "인증이 필요하거나 토큰이 유효하지 않음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "회원이 아니거나 해당 프로젝트 히스토리에 접근할 수 없음"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "지정한 프로젝트를 찾을 수 없음"
      )
  })
  public ResponseEntity<ApiResponse<HistoryScanListResponse>> getCurrentUserScanHistory(
      @Parameter(description = "페이지 번호", example = "0")
      @RequestParam(defaultValue = "0") Integer page,
      @Parameter(description = "페이지 크기", example = "20")
      @RequestParam(defaultValue = "20") Integer size,
      @Parameter(description = "프로젝트 ID 필터", example = "101")
      @RequestParam(required = false) Long projectId,
      @Parameter(description = "스캔 상태 필터", example = "DONE")
      @RequestParam(required = false) ScanStatus status,
      @Parameter(description = "스캔 모드 필터", example = "AGENT")
      @RequestParam(required = false) ScanMode scanMode
  ) {
    // 컨트롤러는 HTTP 요청과 응답 매핑만 담당하고,
    // 페이지네이션, 필터링, 권한 검증, 집계 계산은 서비스에 위임한다.
    HistoryScanListResponse data = historyScanQueryService.getCurrentUserScanHistory(
        page,
        size,
        projectId,
        status,
        scanMode
    );
    return ResponseEntity.ok(ApiResponse.success(GET_HISTORY_SCANS_SUCCESS_MESSAGE, data));
  }
}
