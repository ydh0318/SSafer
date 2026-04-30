package com.ssafer.agent.ws;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "agent.heartbeat")
public class AgentHeartbeatProperties {

  // Agent가 heartbeat(PING)를 보내는 기준 주기(초)
  private long pingIntervalSeconds = 30;
  // last_seen_at 기준 OFFLINE 전환 timeout(초)
  private long timeoutSeconds = 90;

  public long getPingIntervalSeconds() {
    return pingIntervalSeconds;
  }

  public void setPingIntervalSeconds(long pingIntervalSeconds) {
    this.pingIntervalSeconds = pingIntervalSeconds;
  }

  public long getTimeoutSeconds() {
    return timeoutSeconds;
  }

  public void setTimeoutSeconds(long timeoutSeconds) {
    this.timeoutSeconds = timeoutSeconds;
  }
}
