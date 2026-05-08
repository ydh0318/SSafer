package com.ssafer.scan.api.dto;

import com.ssafer.project.domain.enums.ScanMode;
import java.util.List;

// 프로젝트 점검 옵션 조회 응답 본문(data).
// defaultScanMode는 설정값 그대로, availableScanModes는 "현재 선택 가능한 모드"만 내려준다.
public record ProjectScanOptionsResponseData(
    ScanMode defaultScanMode,
    List<ScanMode> availableScanModes,
    boolean monitorEnabled,
    boolean agentAvailable
) {
}
