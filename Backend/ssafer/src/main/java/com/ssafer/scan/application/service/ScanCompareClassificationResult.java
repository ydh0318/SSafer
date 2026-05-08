package com.ssafer.scan.application.service;

import java.util.List;

// 결과 비교 2단계에서는 신규, 해결, 유지 취약점 분류 결과까지만 계산한다.
public record ScanCompareClassificationResult(
    List<ScanCompareFindingCandidate> newFindings,
    List<ScanCompareFindingCandidate> resolvedFindings,
    List<ScanCompareMatchedFinding> retainedFindings
) {
}
