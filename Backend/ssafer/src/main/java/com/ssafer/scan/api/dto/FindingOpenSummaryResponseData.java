package com.ssafer.scan.api.dto;

import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.util.List;
import java.util.Map;

public record FindingOpenSummaryResponseData(
    FindingOpenSummaryScopeResponse scope,
    long openCount,
    Map<Severity, Long> bySeverity,
    List<ResolutionStatus> includedStatuses
) {
}
