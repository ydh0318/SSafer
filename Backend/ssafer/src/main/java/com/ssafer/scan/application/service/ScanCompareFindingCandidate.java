package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.Severity;

// 결과 비교의 동일 finding 판단은 fingerprint를 기준으로 고정한다.
public record ScanCompareFindingCandidate(
    Long findingId,
    Long scanId,
    String comparisonKey,
    String fingerprint,
    Severity severity,
    String category,
    String title,
    String filePath,
    Integer lineNumber,
    String ruleCode,
    FindingSourceType sourceType
) {

  public static ScanCompareFindingCandidate from(ScanFinding finding) {
    String comparisonKey = createComparisonKey(finding);
    return new ScanCompareFindingCandidate(
        finding.getId(),
        finding.getScanId(),
        comparisonKey,
        normalizeFingerprint(finding.getFingerprint()),
        finding.getSeverity(),
        finding.getCategory(),
        finding.getTitle(),
        finding.getFilePath(),
        finding.getLineNumber(),
        finding.getRuleCode(),
        finding.getSourceType()
    );
  }

  public boolean isSameFinding(ScanCompareFindingCandidate other) {
    return comparisonKey.equals(other.comparisonKey());
  }

  private static String createComparisonKey(ScanFinding finding) {
    String normalizedFingerprint = normalizeFingerprint(finding.getFingerprint());
    if (!normalizedFingerprint.isEmpty()) {
      return normalizedFingerprint;
    }

    return "fallback:%s|%s|%s|%s|%s".formatted(
        normalizeValue(finding.getSourceType() == null ? null : finding.getSourceType().name()),
        normalizeValue(finding.getRuleCode()),
        normalizeValue(finding.getFilePath()),
        finding.getLineNumber() == null ? "" : finding.getLineNumber(),
        normalizeValue(finding.getTitle())
    );
  }

  private static String normalizeFingerprint(String fingerprint) {
    return fingerprint == null ? "" : fingerprint.trim().toLowerCase();
  }

  private static String normalizeValue(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }
}
