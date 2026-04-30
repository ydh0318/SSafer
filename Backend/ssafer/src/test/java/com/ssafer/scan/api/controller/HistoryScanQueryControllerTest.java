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
    when(historyScanQueryService.getCurrentUserScanHistory())
        .thenReturn(new HistoryScanListResponse(
            List.of(new HistoryScanListItemResponse(
                1001L,
                101L,
                ScanStatus.DONE,
                ScanMode.AGENT,
                LocalDateTime.of(2026, 4, 27, 9, 0),
                LocalDateTime.of(2026, 4, 27, 9, 10)
            ))
        ));

    mockMvc.perform(get("/api/v1/history/scans"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("전체 스캔 히스토리 조회 성공"))
        .andExpect(jsonPath("$.data.items[0].scanId").value(1001))
        .andExpect(jsonPath("$.data.items[0].projectId").value(101))
        .andExpect(jsonPath("$.data.items[0].status").value("DONE"))
        .andExpect(jsonPath("$.data.items[0].scanMode").value("AGENT"));
  }

  @Test
  void getCurrentUserScanHistoryReturnsForbiddenForGuest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(historyScanQueryService.getCurrentUserScanHistory())
        .thenThrow(new BusinessException(ErrorCode.FORBIDDEN));

    mockMvc.perform(get("/api/v1/history/scans"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(historyScanQueryController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
