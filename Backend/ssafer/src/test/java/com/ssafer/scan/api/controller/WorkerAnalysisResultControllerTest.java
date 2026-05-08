package com.ssafer.scan.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.application.service.WorkerAnalysisResultCallbackService;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultControllerTest {

  private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

  @Mock
  private WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @InjectMocks
  private WorkerAnalysisResultController workerAnalysisResultController;

  @Test
  void reportAnalysisResultReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 30);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(1);

    when(workerAnalysisResultCallbackService.report(anyLong(), any(WorkerAnalysisResultCallbackRequest.class))).thenReturn(
        Scan.builder()
            .id(1L)
            .projectId(10L)
            .requestActorType(RequestActorType.USER)
            .scanMode(ScanMode.AGENT)
            .status(ScanStatus.RUNNING)
            .analysisResultPath("s3://ssafer/result/1/analysis_result.json")
            .requestedAt(requestedAt)
            .lastUpdatedAt(lastUpdatedAt)
            .build());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        "analysis_completed",
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        lastUpdatedAt);

    mockMvc.perform(post("/api/v1/internal/scans/1/analysis-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scanId").value(1))
        .andExpect(jsonPath("$.projectId").value(10))
        .andExpect(jsonPath("$.scanMode").value("AGENT"))
        .andExpect(jsonPath("$.status").value("RUNNING"))
        .andExpect(jsonPath("$.analysisResultPath").value("s3://ssafer/result/1/analysis_result.json"));
  }

  @Test
  void reportAnalysisRunningStatusReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 30);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(2);

    when(workerAnalysisResultCallbackService.report(anyLong(), any(WorkerAnalysisResultCallbackRequest.class))).thenReturn(
        Scan.builder()
            .id(1L)
            .projectId(10L)
            .requestActorType(RequestActorType.USER)
            .scanMode(ScanMode.AGENT)
            .status(ScanStatus.RUNNING)
            .requestedAt(requestedAt)
            .startedAt(startedAt)
            .lastUpdatedAt(lastUpdatedAt)
            .build());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.RUNNING,
        null,
        null,
        null,
        startedAt,
        null,
        lastUpdatedAt);

    mockMvc.perform(post("/api/v1/internal/scans/1/analysis-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scanId").value(1))
        .andExpect(jsonPath("$.projectId").value(10))
        .andExpect(jsonPath("$.scanMode").value("AGENT"))
        .andExpect(jsonPath("$.status").value("RUNNING"));
  }

  @Test
  void reportAnalysisResultWithoutTaskIdReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        null,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/1/analysis-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void reportAnalysisResultWhenScanMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(workerAnalysisResultCallbackService.report(anyLong(), any(WorkerAnalysisResultCallbackRequest.class)))
        .thenThrow(new ResponseStatusException(NOT_FOUND, "Scan not found: 999"));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        999L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/999/analysis_result.json",
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/999/analysis-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isNotFound());
  }

  @Test
  void reportAnalysisResultWhenScanIsTerminalReturnsConflict() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(workerAnalysisResultCallbackService.report(anyLong(), any(WorkerAnalysisResultCallbackRequest.class)))
        .thenThrow(new ResponseStatusException(CONFLICT, "Analysis result callback is not allowed"));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/1/analysis-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isConflict());
  }

  private MockMvc buildMockMvc() {
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    return MockMvcBuilders.standaloneSetup(workerAnalysisResultController)
        .setValidator(validator)
        .build();
  }
}
