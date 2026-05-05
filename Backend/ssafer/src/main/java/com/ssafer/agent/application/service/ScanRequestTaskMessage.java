package com.ssafer.agent.application.service;

// 워커가 raw 결과 적재 작업을 시작할 때 필요한 최소 메시지 규격이다.
public record ScanRequestTaskMessage(
    Long taskId,
    Long agentId,
    Long projectId,
    Long scanId,
    String rawResultPath,
    Integer resultCount,
    String tool,
    String toolVersion,
    String payloadHash
) {
}
