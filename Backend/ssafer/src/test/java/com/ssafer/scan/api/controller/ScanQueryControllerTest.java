package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ScanQueryControllerTest {

  @Mock
  private ScanBasicQueryService scanBasicQueryService;

  @InjectMocks
  private ScanQueryController scanQueryController;

  @Test
  void getScanBasicReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 23, 9, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime completedAt = requestedAt.plusMinutes(3);
    LocalDateTime lastUpdatedAt = completedAt;

    when(scanBasicQueryService.getScanBasic(1001L)).thenReturn(new ScanBasicResponse(
        1001L,
        101L,
        ScanMode.AGENT,
        ScanStatus.DONE,
        "completed",
        null,
        "s3://ssafer/raw/1001/scan_result.json",
        requestedAt,
        startedAt,
        completedAt,
        lastUpdatedAt));

    mockMvc.perform(get("/api/v1/scans/1001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 기본 조회 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.projectId").value(101))
        .andExpect(jsonPath("$.data.scanMode").value("AGENT"))
        .andExpect(jsonPath("$.data.status").value("DONE"))
        .andExpect(jsonPath("$.data.progressStep").value("completed"))
        .andExpect(jsonPath("$.data.rawResultPath").value("s3://ssafer/raw/1001/scan_result.json"));
  }

  @Test
  void getScanBasicWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanBasicQueryService.getScanBasic(999L))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Resource not found"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(scanQueryController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
