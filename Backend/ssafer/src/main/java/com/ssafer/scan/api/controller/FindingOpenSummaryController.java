package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.FindingOpenSummaryResponseData;
import com.ssafer.scan.application.service.FindingOpenSummaryQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/findings")
@RequiredArgsConstructor
@Tag(name = "Finding Summary", description = "Finding summary APIs")
public class FindingOpenSummaryController {

  private static final String GET_OPEN_SUMMARY_SUCCESS_MESSAGE = "Open finding summary retrieved";

  private final FindingOpenSummaryQueryService findingOpenSummaryQueryService;

  @GetMapping("/open-summary")
  @Operation(
      summary = "Get open finding summary",
      description = "Returns OPEN and IN_PROGRESS finding counts by latest DONE scan scope."
  )
  public ResponseEntity<ApiResponse<FindingOpenSummaryResponseData>> getOpenSummary(
      @Parameter(description = "project ID", example = "123")
      @RequestParam(required = false) Long projectId
  ) {
    FindingOpenSummaryResponseData data = findingOpenSummaryQueryService.getOpenSummary(projectId);
    return ResponseEntity.ok(ApiResponse.success(GET_OPEN_SUMMARY_SUCCESS_MESSAGE, data));
  }
}
