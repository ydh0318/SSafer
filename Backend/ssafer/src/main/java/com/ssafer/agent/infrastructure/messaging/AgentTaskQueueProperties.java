package com.ssafer.agent.infrastructure.messaging;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "agent.task.queue")
public class AgentTaskQueueProperties {

  // 백엔드가 작업 메시지를 발행하는 exchange 이름이다.
  private String exchange = "ssafer.agent.tasks";
  // scan 요청 작업을 적재할 큐 이름이다.
  private String scanRequestQueue = "ssafer.agent.scan.request";
  // scan 요청 작업 발행 시 사용할 routing key다.
  private String scanRequestRoutingKey = "agent.scan.request";

  public String getExchange() {
    return exchange;
  }

  public void setExchange(String exchange) {
    this.exchange = exchange;
  }

  public String getScanRequestQueue() {
    return scanRequestQueue;
  }

  public void setScanRequestQueue(String scanRequestQueue) {
    this.scanRequestQueue = scanRequestQueue;
  }

  public String getScanRequestRoutingKey() {
    return scanRequestRoutingKey;
  }

  public void setScanRequestRoutingKey(String scanRequestRoutingKey) {
    this.scanRequestRoutingKey = scanRequestRoutingKey;
  }
}
