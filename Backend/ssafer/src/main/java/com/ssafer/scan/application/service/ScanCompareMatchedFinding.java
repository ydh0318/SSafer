package com.ssafer.scan.application.service;

// 유지 취약점은 기준 스캔과 대상 스캔의 finding 쌍으로 관리한다.
public record ScanCompareMatchedFinding(
    ScanCompareFindingCandidate baseFinding,
    ScanCompareFindingCandidate targetFinding
) {
}
