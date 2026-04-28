package com.ssafer.scan.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.CreateScanRequest;
import com.ssafer.scan.application.service.ScanRegistrationResult;
import com.ssafer.scan.application.service.ScanRegistrationService;
import com.ssafer.scan.domain.enums.ScanStatus;
import org.hamcrest.Matchers;
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
class ScanRequestControllerTest {

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ScanRegistrationService scanRegistrationService;

  @InjectMocks
  private ScanRequestController scanRequestController;

  @Test
  void createScanReturnsCreatedResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRegistrationService.register(any(), any(CreateScanRequest.class))).thenReturn(
        new ScanRegistrationResult(
            1001L,
            2001L,
            ScanStatus.REQUESTED,
            "s3://ssafer/raw/1001/11111111-1111-1111-1111-111111111111/scan_result.json",
            "https://presigned-url.example.com"));

    String requestBody = """
        {
          "projectName": "sample-app",
          "source": "AGENT",
          "scanName": "로컬 서버 점검",
          "targetPath": "/opt/app",
          "includeLogs": false
        }
        """;

    mockMvc.perform(post("/api/v1/scans")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.message").value("스캔 요청 등록 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.projectId").value(2001))
        .andExpect(jsonPath("$.data.status").value("REQUESTED"))
        .andExpect(jsonPath(
            "$.data.rawResultPath",
            Matchers.matchesPattern("^s3://ssafer/raw/1001/.+/scan_result\\.json$")))
        .andExpect(jsonPath("$.data.rawUploadUrl").value("https://presigned-url.example.com"));
  }

  @Test
  void createScanWithoutProjectNameReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    String requestBody = """
        {
          "source": "AGENT",
          "scanName": "로컬 서버 점검"
        }
        """;

    mockMvc.perform(post("/api/v1/scans")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createScanWithInvalidSourceReturnsBadRequest() throws Exception {
    MockMvc mockMvc = buildMockMvc();

    String requestBody = """
        {
          "projectName": "sample-app",
          "source": "UNKNOWN"
        }
        """;

    mockMvc.perform(post("/api/v1/scans")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createScanWithoutSourceStillAccepted() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRegistrationService.register(any(), any(CreateScanRequest.class))).thenReturn(
        new ScanRegistrationResult(
            1002L,
            2002L,
            ScanStatus.REQUESTED,
            "s3://ssafer/raw/1002/22222222-2222-2222-2222-222222222222/scan_result.json",
            "https://presigned-url.example.com"));

    String requestBody = """
        {
          "projectName": "sample-app"
        }
        """;

    mockMvc.perform(post("/api/v1/scans")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.scanId").value(1002));
  }

  private MockMvc buildMockMvc() {
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    return MockMvcBuilders.standaloneSetup(scanRequestController)
        .setValidator(validator)
        .build();
  }
}
