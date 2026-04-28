package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.ScanStatus;

// 스캔 등록 처리 결과를 컨트롤러로 전달하는 DTO.
public record ScanRegistrationResult(
    Long scanId,
    Long projectId,
    ScanStatus status,
    String rawResultPath,
    String rawUploadUrl
) {
}
