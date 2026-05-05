package com.ssafer.agent.application.service;

public interface AgentTaskPublisher {

  void publishScanRequest(ScanRequestTaskMessage message);
}
