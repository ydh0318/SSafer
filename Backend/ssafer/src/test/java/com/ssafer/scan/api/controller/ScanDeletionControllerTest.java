package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.DeleteScanResponseData;
import com.ssafer.scan.application.service.ScanDeletionService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ScanDeletionControllerTest {

  @Mock
  private ScanDeletionService scanDeletionService;

  @InjectMocks
  private ScanDeletionController scanDeletionController;

  @Test
  void deleteScanReturnsOk() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanDeletionService.deleteScan(1001L))
        .thenReturn(new DeleteScanResponseData(1001L, Instant.parse("2026-04-27T09:20:00Z")));

    mockMvc.perform(delete("/api/v1/scans/1001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 이력 삭제 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.deletedAt").value("2026-04-27T09:20:00Z"));
  }

  @Test
  void deleteScanWhenStatusConflictReturnsConflict() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanDeletionService.deleteScan(1001L))
        .thenThrow(new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT));

    mockMvc.perform(delete("/api/v1/scans/1001"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SCAN_STATUS_CONFLICT"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(scanDeletionController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
