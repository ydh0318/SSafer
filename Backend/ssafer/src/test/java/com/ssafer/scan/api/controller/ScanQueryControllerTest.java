package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.dto.ScanCompareFindingResponse;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.api.dto.ScanCompareSeverityChangedFindingResponse;
import com.ssafer.scan.api.dto.ScanCompareSummaryResponse;
import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.api.dto.ScanFindingListResponseData;
import com.ssafer.scan.api.dto.ScanStatusResponse;
import com.ssafer.scan.api.dto.ScanSummaryResponse;
import com.ssafer.scan.application.service.ScanBasicQueryService;
import com.ssafer.scan.application.service.ScanCompareQueryService;
import com.ssafer.scan.application.service.ScanFindingDetailQueryService;
import com.ssafer.scan.application.service.ScanFindingListQueryService;
import com.ssafer.scan.application.service.ScanStatusQueryService;
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
  private ScanCompareQueryService scanCompareQueryService;
  @Mock
  private ScanBasicQueryService scanBasicQueryService;
  @Mock
  private ScanStatusQueryService scanStatusQueryService;
  @Mock
  private ScanSummaryQueryService scanSummaryQueryService;
  @Mock
  private ScanFindingListQueryService scanFindingListQueryService;
  @Mock
  private ScanFindingDetailQueryService scanFindingDetailQueryService;

  @InjectMocks
  private ScanQueryController scanQueryController;

  @Test
  void compareScansReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanCompareQueryService.compare(1001L, 1002L))
        .thenReturn(new ScanCompareResponse(
            1001L,
            1002L,
            101L,
            ScanStatus.DONE,
            ScanStatus.DONE,
            new ScanCompareSummaryResponse(3L, 4L, 1L, 1L, 1L, 1L),
            List.of(new ScanCompareFindingResponse(
                2001L,
                1002L,
                "sha256:new",
                "sha256:new",
                FindingSourceType.TRIVY,
                Severity.MEDIUM,
                "CONFIG",
                "New finding",
                "Dockerfile",
                12,
                "DS-0002"
            )),
            List.of(),
            List.of(),
            List.of(new ScanCompareSeverityChangedFindingResponse(
                new ScanCompareFindingResponse(
                    100L,
                    1001L,
                    "sha256:changed",
                    "sha256:changed",
                    FindingSourceType.CUSTOM_RULE,
                    Severity.HIGH,
                    "SECRET",
                    "Base finding",
                    ".env",
                    1,
                    "ENV-001"
                ),
                new ScanCompareFindingResponse(
                    101L,
                    1002L,
                    "sha256:changed",
                    "sha256:changed",
                    FindingSourceType.CUSTOM_RULE,
                    Severity.LOW,
                    "SECRET",
                    "Target finding",
                    ".env",
                    1,
                    "ENV-001"
                ),
                Severity.HIGH,
                Severity.LOW
            ))
        ));

    mockMvc.perform(get("/api/v1/scans/compare")
            .param("baseScanId", "1001")
            .param("targetScanId", "1002"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 결과 비교 조회 성공"))
        .andExpect(jsonPath("$.data.baseScanId").value(1001))
        .andExpect(jsonPath("$.data.targetScanId").value(1002))
        .andExpect(jsonPath("$.data.projectId").value(101))
        .andExpect(jsonPath("$.data.baseStatus").value("DONE"))
        .andExpect(jsonPath("$.data.targetStatus").value("DONE"))
        .andExpect(jsonPath("$.data.summary.baseFindingCount").value(3))
        .andExpect(jsonPath("$.data.summary.targetFindingCount").value(4))
        .andExpect(jsonPath("$.data.summary.newCount").value(1))
        .andExpect(jsonPath("$.data.summary.resolvedCount").value(1))
        .andExpect(jsonPath("$.data.summary.retainedCount").value(1))
        .andExpect(jsonPath("$.data.summary.severityChangedCount").value(1))
        .andExpect(jsonPath("$.data.newFindings[0].findingId").value(2001))
        .andExpect(jsonPath("$.data.severityChangedFindings[0].baseSeverity").value("HIGH"))
        .andExpect(jsonPath("$.data.severityChangedFindings[0].targetSeverity").value("LOW"));
  }

  @Test
  void compareScansWhenInvalidParameterReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanCompareQueryService.compare(1001L, 1001L))
        .thenThrow(new BusinessException(ErrorCode.INVALID_PARAMETER));

    mockMvc.perform(get("/api/v1/scans/compare")
            .param("baseScanId", "1001")
            .param("targetScanId", "1001"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

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
        lastUpdatedAt
    ));

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
  void getScanStatusReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanStatusQueryService.getScanStatus(1001L)).thenReturn(new ScanStatusResponse(
        1001L,
        ScanStatus.FAILED,
        "ANALYSIS_FAILED",
        LocalDateTime.of(2026, 4, 27, 9, 0),
        LocalDateTime.of(2026, 4, 27, 9, 1),
        LocalDateTime.of(2026, 4, 27, 9, 3),
        "Agent timeout"
    ));

    mockMvc.perform(get("/api/v1/scans/1001/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 진행 상태 조회 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.status").value("FAILED"))
        .andExpect(jsonPath("$.data.progressStep").value("ANALYSIS_FAILED"))
        .andExpect(jsonPath("$.data.errorMessage").value("Agent timeout"));
  }

  @Test
  void getScanStatusWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanStatusQueryService.getScanStatus(999L))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/999/status"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Resource not found"));
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
        Map.of("OPEN", 3L)
    ));

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
    when(scanFindingListQueryService.getScanFindings(
        1001L,
        Severity.HIGH,
        "CONFIG",
        FindingSourceType.TRIVY,
        ResolutionStatus.OPEN,
        3001L,
        0,
        20
    )).thenReturn(new ScanFindingListResponseData(
        List.of(
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
        ),
        0,
        20,
        1L,
        1
    ));

    mockMvc.perform(get("/api/v1/scans/1001/findings")
            .param("severity", "HIGH")
            .param("category", "CONFIG")
            .param("sourceType", "TRIVY")
            .param("resolutionStatus", "OPEN")
            .param("scanNodeId", "3001")
            .param("page", "0")
            .param("size", "20"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 취약점 목록 조회 성공"))
        .andExpect(jsonPath("$.data.page").value(0))
        .andExpect(jsonPath("$.data.size").value(20))
        .andExpect(jsonPath("$.data.totalElements").value(1))
        .andExpect(jsonPath("$.data.totalPages").value(1))
        .andExpect(jsonPath("$.data.items[0].findingId").value(2001))
        .andExpect(jsonPath("$.data.items[0].scanId").value(1001))
        .andExpect(jsonPath("$.data.items[0].scanNodeId").value(3001))
        .andExpect(jsonPath("$.data.items[0].sourceType").value("TRIVY"))
        .andExpect(jsonPath("$.data.items[0].severity").value("HIGH"))
        .andExpect(jsonPath("$.data.items[0].category").value("CONFIG"))
        .andExpect(jsonPath("$.data.items[0].lineNumber").value(2))
        .andExpect(jsonPath("$.data.items[0].resolutionStatus").value("OPEN"));
  }

  @Test
  void getScanFindingsWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanFindingListQueryService.getScanFindings(
        999L, null, null, null, null, null, 0, 20
    )).thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/999/findings"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Resource not found"));
  }

  @Test
  void getScanFindingDetailReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanFindingDetailQueryService.getScanFindingDetail(1001L, 2001L))
        .thenReturn(new ScanFindingDetailResponse(
            2001L,
            1001L,
            3001L,
            FindingSourceType.TRIVY,
            "sha256:abc123",
            Severity.HIGH,
            "CONFIG",
            "Image user should not be 'root'",
            "Running containers with root is risky",
            "Dockerfile",
            2,
            "Dockerfile",
            "DS-0002",
            "Container escape",
            "Use non-root user",
            "{\"line\":2}",
            ResolutionStatus.OPEN,
            1L,
            LocalDateTime.of(2026, 4, 27, 10, 0),
            "Patch prepared",
            "Dockerfile.bak",
            "/backup/Dockerfile.bak",
            "{\"size\":128}",
            LocalDateTime.of(2026, 4, 27, 10, 5),
            LocalDateTime.of(2026, 4, 27, 9, 30)
        ));

    mockMvc.perform(get("/api/v1/scans/1001/findings/2001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 취약점 상세 조회 성공"))
        .andExpect(jsonPath("$.data.findingId").value(2001))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.scanNodeId").value(3001))
        .andExpect(jsonPath("$.data.sourceType").value("TRIVY"))
        .andExpect(jsonPath("$.data.severity").value("HIGH"))
        .andExpect(jsonPath("$.data.category").value("CONFIG"))
        .andExpect(jsonPath("$.data.title").value("Image user should not be 'root'"))
        .andExpect(jsonPath("$.data.filePath").value("Dockerfile"))
        .andExpect(jsonPath("$.data.lineNumber").value(2))
        .andExpect(jsonPath("$.data.ruleCode").value("DS-0002"))
        .andExpect(jsonPath("$.data.resolutionStatus").value("OPEN"));
  }

  @Test
  void getScanFindingDetailWhenMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanFindingDetailQueryService.getScanFindingDetail(1001L, 9999L))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/scans/1001/findings/9999"))
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
