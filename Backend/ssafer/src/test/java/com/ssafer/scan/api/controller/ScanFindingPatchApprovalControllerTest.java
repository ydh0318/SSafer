package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.application.service.ScanFindingPatchApprovalResult;
import com.ssafer.scan.application.service.ScanFindingPatchApprovalService;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import java.time.Instant;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ScanFindingPatchApprovalControllerTest {

  @Mock
  private ScanFindingPatchApprovalService scanFindingPatchApprovalService;

  @InjectMocks
  private ScanFindingPatchApprovalController scanFindingPatchApprovalController;

  @Test
  void approvePatchReturnsOkResponse() throws Exception {
    when(scanFindingPatchApprovalService.approve(1001L, 2001L))
        .thenReturn(new ScanFindingPatchApprovalResult(
            1001L,
            2001L,
            3001L,
            10L,
            ResolutionStatus.IN_PROGRESS,
            RequestActorType.USER,
            1L,
            LocalDateTime.of(2026, 5, 8, 13, 0),
            Instant.parse("2026-05-08T04:00:00Z")
        ));

    buildMockMvc().perform(post("/api/v1/scans/1001/findings/2001/approve"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("취약점 패치 승인 성공"))
        .andExpect(jsonPath("$.data.scanId").value(1001))
        .andExpect(jsonPath("$.data.findingId").value(2001))
        .andExpect(jsonPath("$.data.agentTaskId").value(3001))
        .andExpect(jsonPath("$.data.agentId").value(10))
        .andExpect(jsonPath("$.data.resolutionStatus").value("IN_PROGRESS"))
        .andExpect(jsonPath("$.data.patchApprovedActorType").value("USER"))
        .andExpect(jsonPath("$.data.patchApprovedByUserId").value(1));
  }

  @Test
  void approvePatchWhenPayloadMissingReturnsConflict() throws Exception {
    when(scanFindingPatchApprovalService.approve(1001L, 2001L))
        .thenThrow(new BusinessException(ErrorCode.PATCH_PAYLOAD_NOT_FOUND));

    buildMockMvc().perform(post("/api/v1/scans/1001/findings/2001/approve"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PATCH_PAYLOAD_NOT_FOUND"));
  }

  @Test
  void approvePatchWhenUploadScanReturnsUploadPatchNotAllowed() throws Exception {
    when(scanFindingPatchApprovalService.approve(1001L, 2001L))
        .thenThrow(new BusinessException(ErrorCode.UPLOAD_PATCH_NOT_ALLOWED));

    buildMockMvc().perform(post("/api/v1/scans/1001/findings/2001/approve"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("UPLOAD_PATCH_NOT_ALLOWED"))
        .andExpect(jsonPath("$.message").value("Patch approval is not supported for upload scans"));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(scanFindingPatchApprovalController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }
}
