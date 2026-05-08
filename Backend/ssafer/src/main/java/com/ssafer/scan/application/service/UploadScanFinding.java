package com.ssafer.scan.application.service;

public record UploadScanFinding(
    // 초기 탐지 결과의 식별자(최종 JSON 직렬화 시 재번호 부여 가능)
    String id,
    // 룰 식별자 (예: ENV_PLAIN_SECRET, DS002)
    String ruleId,
    // 탐지 출처 (trivy / custom-rule)
    String source,
    String severity,
    String file,
    Integer line,
    String title,
    String maskedEvidence
) {
}
