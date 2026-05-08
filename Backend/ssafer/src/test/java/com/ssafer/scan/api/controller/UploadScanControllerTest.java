package com.ssafer.scan.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.application.service.UploadScanResult;
import com.ssafer.scan.application.service.UploadScanService;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class UploadScanControllerTest {

  @Mock
  private UploadScanService uploadScanService;

  @InjectMocks
  private UploadScanController uploadScanController;

  @Test
  void requestUploadScanReturnsCreatedWhenQueued() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );
    MockMultipartFile scanNamePart = new MockMultipartFile(
        "scanName",
        "",
        "text/plain",
        "scan-a".getBytes(StandardCharsets.UTF_8)
    );

    when(uploadScanService.requestUploadScan(eq(101L), eq("scan-a"), any()))
        .thenReturn(new UploadScanResult(1001L, ScanStatus.QUEUED, null, null));

    mockMvc.perform(multipart("/api/v1/projects/101/scans/upload")
            .file(file)
            .file(scanNamePart))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.scanId").value(1001L))
        .andExpect(jsonPath("$.data.status").value("QUEUED"));
  }

  @Test
  void requestUploadScanReturns500WhenQueuePublishFailsAfterCreation() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(uploadScanService.requestUploadScan(eq(101L), eq(null), any()))
        .thenReturn(new UploadScanResult(
            1001L,
            ScanStatus.RAW_UPLOADED,
            ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED,
            ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED
        ));

    mockMvc.perform(multipart("/api/v1/projects/101/scans/upload")
            .file(file))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.code").value("ANALYSIS_QUEUE_PUBLISH_FAILED"))
        .andExpect(jsonPath("$.data.scanId").value(1001L))
        .andExpect(jsonPath("$.data.status").value("RAW_UPLOADED"))
        .andExpect(jsonPath("$.data.failureReason").value("ANALYSIS_QUEUE_PUBLISH_FAILED"));
  }

  @Test
  void requestUploadScanWhenPermitBusyReturns429() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "A".getBytes(StandardCharsets.UTF_8)
    );

    when(uploadScanService.requestUploadScan(eq(101L), eq(null), any()))
        .thenThrow(new BusinessException(ErrorCode.SCAN_EXECUTION_BUSY));

    mockMvc.perform(multipart("/api/v1/projects/101/scans/upload")
            .file(file))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("SCAN_EXECUTION_BUSY"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(uploadScanController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
