package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.application.service.CliRawResultUploadReportService;
import com.ssafer.scan.domain.enums.ScanStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

@ExtendWith(MockitoExtension.class)
class CliRawResultUploadReportControllerTest {

  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private CliRawResultUploadReportService cliRawResultUploadReportService;

  @InjectMocks
  private CliRawResultUploadReportController controller;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void reportSuccessReturnsOk() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(10L));
    when(cliRawResultUploadReportService.report(
        org.mockito.ArgumentMatchers.eq(1001L),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any()
    )).thenReturn(new CliRawResultUploadReportResponseData(1001L, ScanStatus.RAW_UPLOADED, 152));

    CliRawResultUploadReportRequest request = new CliRawResultUploadReportRequest(
        "ssafer-cli",
        "1.4.0",
        152,
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    mockMvc.perform(post("/api/v1/scans/1001/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Raw 결과 업로드 완료 보고 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.status").value("RAW_UPLOADED"))
        .andExpect(jsonPath("$.data.resultCount").value(152));
  }

  @Test
  void reportWithInvalidPayloadHashReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(10L));
    when(cliRawResultUploadReportService.report(
        org.mockito.ArgumentMatchers.eq(1001L),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any()
    )).thenThrow(new BusinessException(ErrorCode.INVALID_PAYLOAD_HASH));

    CliRawResultUploadReportRequest request = new CliRawResultUploadReportRequest(
        "ssafer-cli",
        "1.4.0",
        152,
        "sha256:abc123"
    );

    mockMvc.perform(post("/api/v1/scans/1001/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PAYLOAD_HASH"));
  }

  private MockMvc buildMockMvc() {
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    return MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .setValidator(validator)
        .build();
  }
}
