package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.application.service.ScanFindingListQueryService;
import com.ssafer.scan.application.service.ScanSummaryQueryService;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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

  @Mock
  private ScanSummaryQueryService scanSummaryQueryService;

  @Mock
  private ScanFindingListQueryService scanFindingListQueryService;

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

  @Test
  void getScanSummaryReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    when(scanSummaryQueryService.getScanSummary(1001L)).thenReturn(new ScanSummaryResponse(
        1001L,
        101L,
        12L,
        3L,
        1L,
        2L,
        4L,
        3L,
        2L,
        Map.of("CONFIG", 2L, "SECRET", 1L),
        Map.of("TRIVY", 2L, "CUSTOM_RULE", 1L),
        Map.of("OPEN", 3L)));

    mockMvc.perform(get("/api/v1/scans/1001/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 결과 요약 조회 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.projectId").value(101))
        .andExpect(jsonPath("$.data.totalFindings").value(12))
        .andExpect(jsonPath("$.data.nodeCount").value(3))
        .andExpect(jsonPath("$.data.criticalCount").value(1))
        .andExpect(jsonPath("$.data.highCount").value(2))
        .andExpect(jsonPath("$.data.mediumCount").value(4))
        .andExpect(jsonPath("$.data.lowCount").value(3))
        .andExpect(jsonPath("$.data.infoCount").value(2))
        .andExpect(jsonPath("$.data.categoryCounts.CONFIG").value(2))
        .andExpect(jsonPath("$.data.categoryCounts.SECRET").value(1))
        .andExpect(jsonPath("$.data.sourceCounts.TRIVY").value(2))
        .andExpect(jsonPath("$.data.sourceCounts.CUSTOM_RULE").value(1))
        .andExpect(jsonPath("$.data.resolutionCounts.OPEN").value(3));
  }

  @Test
  void getScanSummaryWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanSummaryQueryService.getScanSummary(999L))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/999/summary"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Resource not found"));
  }

  @Test
  void getScanFindingsReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanFindingListQueryService.getScanFindings(1001L)).thenReturn(List.of(
        new ScanFindingListItemResponse(
            2001L,
            1001L,
            3001L,
            FindingSourceType.TRIVY,
            Severity.HIGH,
            "CONFIG",
            "Image user should not be 'root'",
            "Dockerfile",
            2,
            "Dockerfile",
            "DS-0002",
            ResolutionStatus.OPEN,
            LocalDateTime.of(2026, 4, 27, 9, 30)
        )
    ));

    mockMvc.perform(get("/api/v1/scans/1001/findings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 취약점 목록 조회 성공"))
        .andExpect(jsonPath("$.data[0].findingId").value(2001))
        .andExpect(jsonPath("$.data[0].scanId").value(1001))
        .andExpect(jsonPath("$.data[0].scanNodeId").value(3001))
        .andExpect(jsonPath("$.data[0].sourceType").value("TRIVY"))
        .andExpect(jsonPath("$.data[0].severity").value("HIGH"))
        .andExpect(jsonPath("$.data[0].category").value("CONFIG"))
        .andExpect(jsonPath("$.data[0].lineNumber").value(2))
        .andExpect(jsonPath("$.data[0].resolutionStatus").value("OPEN"));
  }

  @Test
  void getScanFindingsWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanFindingListQueryService.getScanFindings(999L))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/999/findings"))
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
