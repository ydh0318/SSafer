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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
@Tag(name = "업로드 점검 요청", description = "웹 업로드 기반 점검 요청 API")
public class UploadScanController {

  private static final String REQUEST_UPLOAD_SCAN_SUCCESS_MESSAGE = "업로드 기반 점검 요청 성공";

  private final UploadScanService uploadScanService;

  @PostMapping(
      value = "/{projectId}/scans/upload",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE
  )
  @Operation(summary = "업로드 기반 점검 요청", description = "웹 업로드 파일로 점검 요청을 접수합니다.")
  public ResponseEntity<?> requestUploadScan(
      @Parameter(description = "프로젝트 ID", example = "101")
      @PathVariable Long projectId,
      @RequestPart(value = "files", required = false) List<MultipartFile> files,
      @RequestPart(value = "scanName", required = false) String scanName
  ) {
    UploadScanResult result = uploadScanService.requestUploadScan(projectId, scanName, files);
    UploadScanResponseData data = new UploadScanResponseData(
        result.scanId(),
        result.status(),
        result.failureReason()
    );

    if (result.isSuccess()) {
      return ResponseEntity.status(HttpStatus.CREATED)
          .body(ApiResponse.success(REQUEST_UPLOAD_SCAN_SUCCESS_MESSAGE, data));
    }

    Map<String, Object> errorData = new LinkedHashMap<>();
    errorData.put("scanId", result.scanId());
    errorData.put("status", result.status());
    errorData.put("failureReason", result.failureReason());

    return ResponseEntity.status(result.errorCode().status())
        .body(ApiErrorResponse.of(result.errorCode().code(), result.errorCode().message(), errorData));
  }
}
