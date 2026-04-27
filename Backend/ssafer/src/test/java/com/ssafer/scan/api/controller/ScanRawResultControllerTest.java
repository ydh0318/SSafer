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
import com.ssafer.scan.api.dto.RawScanResultUploadRequest;
import com.ssafer.scan.application.service.ScanRawResultUploadService;
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
class ScanRawResultControllerTest {

  private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

  @Mock
  private ScanRawResultUploadService scanRawResultUploadService;

  @InjectMocks
  private ScanRawResultController scanRawResultController;

  @Test
  void uploadRawResultReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 30);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(1);

    when(scanRawResultUploadService.upload(anyLong(), any(RawScanResultUploadRequest.class))).thenReturn(
        Scan.builder()
            .id(1L)
            .projectId(10L)
            .requestActorType(RequestActorType.USER)
            .scanMode(ScanMode.AGENT)
            .status(ScanStatus.RAW_UPLOADED)
            .rawResultPath("s3://ssafer/raw/1/scan_result.json")
            .requestedAt(requestedAt)
            .lastUpdatedAt(lastUpdatedAt)
            .build());

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        "uploaded",
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        lastUpdatedAt);

    mockMvc.perform(post("/api/v1/internal/scans/1/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scanId").value(1))
        .andExpect(jsonPath("$.projectId").value(10))
        .andExpect(jsonPath("$.scanMode").value("AGENT"))
        .andExpect(jsonPath("$.status").value("RAW_UPLOADED"))
        .andExpect(jsonPath("$.rawResultPath").value("s3://ssafer/raw/1/scan_result.json"));
  }

  @Test
  void uploadRawResultWithoutPathReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        null,
        null,
        null,
        null,
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/1/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void uploadRawResultWhenScanMissingReturnsNotFound() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanRawResultUploadService.upload(anyLong(), any(RawScanResultUploadRequest.class)))
        .thenThrow(new ResponseStatusException(NOT_FOUND, "Scan not found: 999"));

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/999/scan_result.json",
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/999/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isNotFound());
  }

  @Test
  void uploadRawResultWhenScanIsTerminalReturnsConflict() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(scanRawResultUploadService.upload(anyLong(), any(RawScanResultUploadRequest.class)))
        .thenThrow(new ResponseStatusException(CONFLICT, "Raw result upload is not allowed"));

    RawScanResultUploadRequest request = new RawScanResultUploadRequest(
        ScanStatus.RAW_UPLOADED,
        null,
        null,
        "s3://ssafer/raw/1/scan_result.json",
        null,
        null,
        null);

    mockMvc.perform(post("/api/v1/internal/scans/1/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isConflict());
  }

  private MockMvc buildMockMvc() {
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    return MockMvcBuilders.standaloneSetup(scanRawResultController)
        .setValidator(validator)
        .build();
  }
}
