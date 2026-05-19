package com.ssafer.scan.api.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.FindingResolutionStatusUpdateResponseData;
import com.ssafer.scan.application.service.FindingResolutionStatusUpdateService;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class FindingResolutionStatusControllerTest {

  @Mock
  private FindingResolutionStatusUpdateService findingResolutionStatusUpdateService;

  @InjectMocks
  private FindingResolutionStatusController findingResolutionStatusController;

  @Test
  void updateResolutionStatusReturnsOkResponse() throws Exception {
    when(findingResolutionStatusUpdateService.updateStatus(
        eq(2001L),
        eq(ResolutionStatus.RESOLVED),
        eq("운영 설정에서 수동 조치 완료 확인")
    )).thenReturn(new FindingResolutionStatusUpdateResponseData(
        2001L,
        1001L,
        ResolutionStatus.OPEN,
        ResolutionStatus.RESOLVED
    ));

    buildMockMvc().perform(patch("/api/v1/findings/2001/resolution-status")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "RESOLVED",
                  "reason": "  운영 설정에서 수동 조치 완료 확인  "
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Finding 조치 상태 변경 성공"))
        .andExpect(jsonPath("$.data.findingId").value(2001))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.previousStatus").value("OPEN"))
        .andExpect(jsonPath("$.data.resolutionStatus").value("RESOLVED"));
  }

  @Test
  void updateResolutionStatusWhenFindingMissingReturnsNotFound() throws Exception {
    when(findingResolutionStatusUpdateService.updateStatus(2001L, ResolutionStatus.IGNORED, null))
        .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    buildMockMvc().perform(patch("/api/v1/findings/2001/resolution-status")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "IGNORED"
                }
                """))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void updateResolutionStatusWhenReasonTooLongReturnsBadRequest() throws Exception {
    String reason = "a".repeat(1001);
    when(findingResolutionStatusUpdateService.updateStatus(2001L, ResolutionStatus.RESOLVED, reason))
        .thenThrow(new BusinessException(ErrorCode.INVALID_PARAMETER));

    buildMockMvc().perform(patch("/api/v1/findings/2001/resolution-status")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "RESOLVED",
                  "reason": "%s"
                }
                """.formatted(reason)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(findingResolutionStatusController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
