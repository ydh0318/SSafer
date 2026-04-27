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
import com.ssafer.scan.domain.enums.ScanRequestSource;
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
// 스캔 시작 컨트롤러의 요청/응답 계약과 검증 동작을 확인한다.
class ScanRequestControllerTest {

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ScanRegistrationService scanRegistrationService;

  @InjectMocks
  private ScanRequestController scanRequestController;

  @Test
  void createScanReturnsOkResponse() throws Exception {
    MockMvc mockMvc = buildMockMvc();
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRegistrationService.register(any(), any(CreateScanRequest.class))).thenReturn(
        new ScanRegistrationResult(
            1001L,
            2001L,
            ScanStatus.REQUESTED,
            "s3://ssafer/raw/1001/scan_result.json",
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
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Agent 로컬 스캔 시작 등록 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.projectId").value(2001))
        .andExpect(jsonPath("$.data.status").value("REQUESTED"))
        .andExpect(jsonPath("$.data.rawResultPath").value("s3://ssafer/raw/1001/scan_result.json"))
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
          "source": "CLI"
        }
        """;

    mockMvc.perform(post("/api/v1/scans")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isBadRequest());
  }

  private MockMvc buildMockMvc() {
    LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    return MockMvcBuilders.standaloneSetup(scanRequestController)
        .setValidator(validator)
        .build();
  }
}
