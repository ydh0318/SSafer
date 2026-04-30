package com.ssafer.agent.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class AgentWebSocketConfig implements WebSocketConfigurer {

  private final AgentWebSocketHandler agentWebSocketHandler;
  private final AgentHandshakeInterceptor agentHandshakeInterceptor;

  public AgentWebSocketConfig(
      AgentWebSocketHandler agentWebSocketHandler,
      AgentHandshakeInterceptor agentHandshakeInterceptor
  ) {
    this.agentWebSocketHandler = agentWebSocketHandler;
    this.agentHandshakeInterceptor = agentHandshakeInterceptor;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    // Agent 전용 WS 연결 엔드포인트 등록
    registry.addHandler(agentWebSocketHandler, "/ws/v1/internal/agents/connect")
        .addInterceptors(agentHandshakeInterceptor)
        .setAllowedOrigins("*");
  }
}
