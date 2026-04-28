package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.ProjectScanListItemResponse;
import com.ssafer.scan.api.dto.ProjectScanListResponse;
import com.ssafer.scan.application.service.ProjectScanListQueryService;
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
class ProjectScanQueryControllerTest {

  @Mock
  private ProjectScanListQueryService projectScanListQueryService;

  @InjectMocks
  private ProjectScanQueryController projectScanQueryController;

  @Test
  void getProjectScansReturnsOk() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(projectScanListQueryService.getProjectScans(101L, 0, 20, ScanStatus.DONE, ScanMode.AGENT))
        .thenReturn(new ProjectScanListResponse(
            List.of(new ProjectScanListItemResponse(
                1001L,
                ScanStatus.DONE,
                ScanMode.AGENT,
                LocalDateTime.of(2026, 4, 27, 9, 0),
                LocalDateTime.of(2026, 4, 27, 9, 10)
            )),
            0,
            20,
            1L,
            1
        ));

    mockMvc.perform(get("/api/v1/projects/101/scans")
            .param("page", "0")
            .param("size", "20")
            .param("status", "DONE")
            .param("scanMode", "AGENT"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("스캔 목록 조회 성공"))
        .andExpect(jsonPath("$.data.page").value(0))
        .andExpect(jsonPath("$.data.size").value(20))
        .andExpect(jsonPath("$.data.totalElements").value(1))
        .andExpect(jsonPath("$.data.totalPages").value(1))
        .andExpect(jsonPath("$.data.items[0].scanId").value(1001))
        .andExpect(jsonPath("$.data.items[0].status").value("DONE"))
        .andExpect(jsonPath("$.data.items[0].scanMode").value("AGENT"));
  }

  @Test
  void getProjectScansWhenProjectMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(projectScanListQueryService.getProjectScans(999L, 0, 20, null, null))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/api/v1/projects/999/scans"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void getProjectScansWhenPageInvalidReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(projectScanListQueryService.getProjectScans(101L, -1, 20, null, null))
        .thenThrow(new BusinessException(ErrorCode.INVALID_PARAMETER));

    mockMvc.perform(get("/api/v1/projects/101/scans").param("page", "-1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(projectScanQueryController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
