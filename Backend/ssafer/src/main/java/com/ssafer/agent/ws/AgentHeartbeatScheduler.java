package com.ssafer.agent.ws;

import com.ssafer.agent.application.service.AgentConnectionService;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AgentHeartbeatScheduler {

  private final AgentConnectionService agentConnectionService;
  private final AgentHeartbeatProperties heartbeatProperties;

  public AgentHeartbeatScheduler(
      AgentConnectionService agentConnectionService,
      AgentHeartbeatProperties heartbeatProperties
  ) {
    this.agentConnectionService = agentConnectionService;
    this.heartbeatProperties = heartbeatProperties;
  }

  @Scheduled(fixedDelayString = "#{${agent.heartbeat.ping-interval-seconds:30} * 1000}")
  public void markHeartbeatTimedOutAgentsOffline() {
    // ping 주기마다 cutoff(now - timeout) 이전 last_seen_at을 가진 ONLINE agent를 OFFLINE으로 정리한다.
    Instant now = Instant.now();
    Instant cutoff = now.minusSeconds(heartbeatProperties.getTimeoutSeconds());
    agentConnectionService.markTimedOutAgentsOffline(cutoff, now);
  }
}
