package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.enums.ScanStatus;

// 트랜잭션 커밋 이후 현재 scan 최종 상태 기준으로 SSE 발행을 요청하는 이벤트다.
public record ScanStatusSsePublishRequestedEvent(
    Long scanId,
    ScanStatus expectedStatus
) {
}
