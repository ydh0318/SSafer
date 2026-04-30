package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.HistoryScanListItemResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.api.dto.HistoryScanSummaryCountResponse;
import com.ssafer.scan.application.service.HistoryScanQueryService;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class HistoryScanQueryControllerTest {

  @Mock
  private HistoryScanQueryService historyScanQueryService;

  @InjectMocks
  private HistoryScanQueryController historyScanQueryController;

  @Test
  void getCurrentUserScanHistoryReturnsOk() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(historyScanQueryService.getCurrentUserScanHistory(0, 20, 101L, ScanStatus.DONE, ScanMode.AGENT))
        .thenReturn(new HistoryScanListResponse(
            new HistoryScanSummaryCountResponse(
                1L,
                12L,
                1L,
                3L,
                5L,
                2L,
                1L
            ),
            List.of(new HistoryScanListItemResponse(
                1001L,
                101L,
                ScanStatus.DONE,
                ScanMode.AGENT,
                12L,
                1L,
                3L,
                5L,
                2L,
                1L,
                LocalDateTime.of(2026, 4, 27, 9, 0),
                LocalDateTime.of(2026, 4, 27, 9, 10)
            )),
            0,
            20,
            1L,
            1
        ));

    mockMvc.perform(get("/api/v1/history/scans")
            .param("page", "0")
            .param("size", "20")
            .param("projectId", "101")
            .param("status", "DONE")
            .param("scanMode", "AGENT"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("전체 스캔 히스토리 조회 성공"))
        .andExpect(jsonPath("$.data.page").value(0))
        .andExpect(jsonPath("$.data.size").value(20))
        .andExpect(jsonPath("$.data.totalElements").value(1))
        .andExpect(jsonPath("$.data.totalPages").value(1))
        .andExpect(jsonPath("$.data.summary.totalScanCount").value(1))
        .andExpect(jsonPath("$.data.summary.totalFindingCount").value(12))
        .andExpect(jsonPath("$.data.summary.criticalCount").value(1))
        .andExpect(jsonPath("$.data.summary.highCount").value(3))
        .andExpect(jsonPath("$.data.items[0].scanId").value(1001))
        .andExpect(jsonPath("$.data.items[0].projectId").value(101))
        .andExpect(jsonPath("$.data.items[0].status").value("DONE"))
        .andExpect(jsonPath("$.data.items[0].scanMode").value("AGENT"))
        .andExpect(jsonPath("$.data.items[0].totalFindingCount").value(12))
        .andExpect(jsonPath("$.data.items[0].criticalCount").value(1))
        .andExpect(jsonPath("$.data.items[0].mediumCount").value(5));
  }

  @Test
  void getCurrentUserScanHistoryReturnsForbiddenForGuest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(historyScanQueryService.getCurrentUserScanHistory(0, 20, null, null, null))
        .thenThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(get("/api/v1/history/scans"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void getCurrentUserScanHistoryWhenPageInvalidReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(historyScanQueryService.getCurrentUserScanHistory(-1, 20, null, null, null))
        .thenThrow(new BusinessException(ErrorCode.INVALID_PARAMETER));

    mockMvc.perform(get("/api/v1/history/scans").param("page", "-1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(historyScanQueryController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
