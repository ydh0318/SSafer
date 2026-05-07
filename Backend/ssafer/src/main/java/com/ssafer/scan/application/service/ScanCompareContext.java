package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.entity.Scan;
import java.util.List;
import java.util.Map;

// 결과 비교 다음 단계에서 신규/해결/유지 분류를 계산할 때 사용하는 내부 컨텍스트다.
public record ScanCompareContext(
    Scan baseScan,
    Scan targetScan,
    List<ScanCompareFindingCandidate> baseFindings,
    List<ScanCompareFindingCandidate> targetFindings,
    Map<String, ScanCompareFindingCandidate> baseFindingsByComparisonKey,
    Map<String, ScanCompareFindingCandidate> targetFindingsByComparisonKey
) {
}
