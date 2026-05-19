package com.ssafer.scan.api.controller;

import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.scan.api.dto.FindingOpenSummaryResponseData;
import com.ssafer.scan.api.dto.FindingOpenSummaryScopeResponse;
import com.ssafer.scan.application.service.FindingOpenSummaryQueryService;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.util.EnumMap;
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
class FindingOpenSummaryControllerTest {

  @Mock
  private FindingOpenSummaryQueryService findingOpenSummaryQueryService;

  @InjectMocks
  private FindingOpenSummaryController findingOpenSummaryController;

  @Test
  void getOpenSummaryReturnsProjectScopeSummary() throws Exception {
    Map<Severity, Long> bySeverity = severityCounts();
    bySeverity.put(Severity.HIGH, 1L);
    bySeverity.put(Severity.MEDIUM, 2L);

    when(findingOpenSummaryQueryService.getOpenSummary(123L))
        .thenReturn(new FindingOpenSummaryResponseData(
            new FindingOpenSummaryScopeResponse("PROJECT", 123L),
            3L,
            bySeverity,
            List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
        ));

    buildMockMvc().perform(get("/api/v1/findings/open-summary")
            .param("projectId", "123"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.scope.type").value("PROJECT"))
        .andExpect(jsonPath("$.data.scope.projectId").value(123))
        .andExpect(jsonPath("$.data.openCount").value(3))
        .andExpect(jsonPath("$.data.bySeverity.CRITICAL").value(0))
        .andExpect(jsonPath("$.data.bySeverity.HIGH").value(1))
        .andExpect(jsonPath("$.data.bySeverity.MEDIUM").value(2))
        .andExpect(jsonPath("$.data.bySeverity.LOW").value(0))
        .andExpect(jsonPath("$.data.bySeverity.INFO").value(0))
        .andExpect(jsonPath("$.data.includedStatuses[0]").value("OPEN"))
        .andExpect(jsonPath("$.data.includedStatuses[1]").value("IN_PROGRESS"));
  }

  @Test
  void getOpenSummaryReturnsWorkspaceScopeSummary() throws Exception {
    when(findingOpenSummaryQueryService.getOpenSummary(null))
        .thenReturn(new FindingOpenSummaryResponseData(
            new FindingOpenSummaryScopeResponse("WORKSPACE", null),
            0L,
            severityCounts(),
            List.of(ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS)
        ));

    buildMockMvc().perform(get("/api/v1/findings/open-summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.scope.type").value("WORKSPACE"))
        .andExpect(jsonPath("$.data.scope.projectId").value(nullValue()))
        .andExpect(jsonPath("$.data.openCount").value(0));
  }

  private MockMvc buildMockMvc() {
    return MockMvcBuilders.standaloneSetup(findingOpenSummaryController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  private Map<Severity, Long> severityCounts() {
    Map<Severity, Long> bySeverity = new EnumMap<>(Severity.class);
    for (Severity severity : Severity.values()) {
      bySeverity.put(severity, 0L);
    }
    return bySeverity;
  }
}
