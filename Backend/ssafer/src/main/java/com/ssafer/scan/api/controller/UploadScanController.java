package com.ssafer.scan.api.controller;

import com.ssafer.global.api.ApiErrorResponse;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.scan.api.dto.UploadScanResponseData;
import com.ssafer.scan.application.service.UploadScanResult;
import com.ssafer.scan.application.service.UploadScanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/scans")
@RequiredArgsConstructor
@Tag(name = "Upload Scan Request", description = "Web upload based scan request API")
public class UploadScanController {

  private static final String REQUEST_UPLOAD_SCAN_SUCCESS_MESSAGE = "업로드 기반 점검 요청 성공";

  private final UploadScanService uploadScanService;

  @PostMapping(
      value = "/upload",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE
  )
  @Operation(
      summary = "업로드 기반 점검 요청",
      description = "업로드 파일을 기반으로 1차 점검을 수행하고 Worker 분석 요청을 발행합니다."
  )
  public ResponseEntity<?> requestUploadScan(
      @Parameter(
          description = "프로젝트 이름(요청자 스코프에서 find-or-create)",
          example = "sample-project",
          required = true
      )
      @RequestPart(value = "projectName", required = false) String projectName,
      @Parameter(
          description = "업로드 파일 목록(1~3개, 총 1MB 이하)",
          required = true
      )
      @RequestPart(value = "files", required = false) List<MultipartFile> files,
      @Parameter(
          description = "스캔 식별용 이름",
          example = "upload-scan-1"
      )
      @RequestPart(value = "scanName", required = false) String scanName
  ) {
    // 업로드 요청을 서비스에 위임하고, 생성 후 실패 케이스까지 동일 응답 포맷으로 변환한다.
    UploadScanResult result = uploadScanService.requestUploadScan(projectName, scanName, files);
    UploadScanResponseData data = new UploadScanResponseData(
        result.scanId(),
        result.status(),
        result.failureReason()
    );

    if (result.isSuccess()) {
      return ResponseEntity.status(HttpStatus.CREATED)
          .body(ApiResponse.success(REQUEST_UPLOAD_SCAN_SUCCESS_MESSAGE, data));
    }

    // Scan 생성 이후 실패한 경우에도 scanId/status/failureReason를 data에 포함해 반환한다.
    Map<String, Object> errorData = new LinkedHashMap<>();
    errorData.put("scanId", result.scanId());
    errorData.put("status", result.status());
    errorData.put("failureReason", result.failureReason());

    return ResponseEntity.status(result.errorCode().status())
        .body(ApiErrorResponse.of(result.errorCode().code(), result.errorCode().message(), errorData));
  }
}
