package com.ssafer.agent.ws;

import com.ssafer.agent.application.service.AgentConnectionService;
import com.ssafer.agent.domain.entity.Agent;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

@Component
public class AgentWebSocketHandler extends TextWebSocketHandler {

  private static final String TYPE_CONNECT = "CONNECT";
  private static final String TYPE_CONNECTED = "CONNECTED";
  private static final String TYPE_PING = "PING";
  private static final String TYPE_PONG = "PONG";

  private final ObjectMapper objectMapper;
  private final AgentConnectionService agentConnectionService;
  private final AgentSessionRegistry sessionRegistry;
  private final AgentAuthenticationProperties authenticationProperties;
  private final byte[] workerSecretBytes;

  public AgentWebSocketHandler(
      ObjectMapper objectMapper,
      AgentConnectionService agentConnectionService,
      AgentSessionRegistry sessionRegistry,
      AgentAuthenticationProperties authenticationProperties,
      @Value("${WORKER_API_SECRET:}") String workerApiSecret
  ) {
    this.objectMapper = objectMapper;
    this.agentConnectionService = agentConnectionService;
    this.sessionRegistry = sessionRegistry;
    this.authenticationProperties = authenticationProperties;
    this.workerSecretBytes = workerApiSecret == null
        ? new byte[0]
        : workerApiSecret.getBytes(StandardCharsets.UTF_8);
  }

  @Override
  public void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
    // 현재 스토리 범위 메시지는 CONNECT/PING 두 가지 타입만 처리한다.
    AgentIncomingMessage incoming = objectMapper.readValue(message.getPayload(), AgentIncomingMessage.class);
    if (TYPE_CONNECT.equals(incoming.type())) {
      handleConnect(session, incoming);
      return;
    }
    if (TYPE_PING.equals(incoming.type())) {
      handlePing(session, incoming);
      return;
    }
    session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unsupported message type"));
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    handleSessionClosed(session.getId());
  }

  @Override
  public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
    handleSessionClosed(session.getId());
    if (session.isOpen()) {
      session.close(CloseStatus.SERVER_ERROR);
    }
  }

  private void handleConnect(WebSocketSession session, AgentIncomingMessage incoming) throws IOException {
    // CONNECT는 agentId/projectId + 인증 토큰이 모두 유효해야만 수락한다.
    if (incoming.agentId() == null || incoming.projectId() == null || !isAuthorized(session)) {
      session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid connect request"));
      return;
    }

    Agent agent = agentConnectionService.loadAgentForConnect(incoming.agentId(), incoming.projectId());
    // 동일 agent 재연결 시 기존 세션을 종료하고 새 세션을 현재 세션으로 교체한다.
    sessionRegistry.register(agent.getId(), session);

    Instant now = Instant.now();
    agentConnectionService.markOnline(agent.getId(), now);

    AgentOutgoingMessage response = AgentOutgoingMessage.connected(agent.getId(), now);
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
  }

  private void handlePing(WebSocketSession session, AgentIncomingMessage incoming) throws IOException {
    // PING은 "해당 세션에 바인딩된 agentId"와 메시지의 agentId가 일치해야만 반영한다.
    Long boundAgentId = sessionRegistry.findAgentIdBySessionId(session.getId());
    if (boundAgentId == null || incoming.agentId() == null || !boundAgentId.equals(incoming.agentId())) {
      session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Agent id mismatch"));
      return;
    }

    Instant now = Instant.now();
    agentConnectionService.touchLastSeen(boundAgentId, now);
    AgentOutgoingMessage response = AgentOutgoingMessage.pong(now);
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
  }

  private void handleSessionClosed(String sessionId) {
    Long agentId = sessionRegistry.findAgentIdBySessionId(sessionId);
    if (agentId == null) {
      return;
    }
    // 구세션 close 이벤트가 새 세션 ONLINE 상태를 덮어쓰지 않도록 현재 유효 세션 여부를 먼저 확인한다.
    if (!sessionRegistry.isCurrentSession(agentId, sessionId)) {
      sessionRegistry.removeSessionBinding(sessionId);
      return;
    }
    boolean removed = sessionRegistry.removeIfCurrent(agentId, sessionId);
    if (removed) {
      agentConnectionService.markOffline(agentId, Instant.now());
    }
  }

  private boolean isAuthorized(WebSocketSession session) {
    Object authAttr = session.getAttributes().get(AgentHandshakeInterceptor.AUTHORIZATION_ATTR);
    String authorization = authAttr instanceof String value ? value : null;
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      return false;
    }
    String token = authorization.substring(7).trim();
    if (token.isEmpty()) {
      return false;
    }

    // agent 전용 토큰이 설정되어 있으면 우선 검증한다.
    String configuredAgentToken = authenticationProperties.getToken();
    if (configuredAgentToken != null && !configuredAgentToken.isBlank()) {
      byte[] agentTokenBytes = configuredAgentToken.getBytes(StandardCharsets.UTF_8);
      if (MessageDigest.isEqual(agentTokenBytes, token.getBytes(StandardCharsets.UTF_8))) {
        return true;
      }
    }

    // agent 토큰이 없거나 불일치하면 internal worker secret도 허용한다.
    if (workerSecretBytes.length == 0) {
      return false;
    }
    return MessageDigest.isEqual(workerSecretBytes, token.getBytes(StandardCharsets.UTF_8));
  }

  private record AgentIncomingMessage(
      String type,
      Long agentId,
      Long projectId,
      String timestamp
  ) {
  }

  private record AgentOutgoingMessage(
      String type,
      String message,
      Map<String, Object> data,
      String serverTime
  ) {
    static AgentOutgoingMessage connected(Long agentId, Instant connectedAt) {
      return new AgentOutgoingMessage(
          TYPE_CONNECTED,
          "에이전트 연결 성공",
          Map.of(
              "agentId", agentId,
              "status", "ONLINE",
              "connectedAt", connectedAt.toString()
          ),
          null
      );
    }

    static AgentOutgoingMessage pong(Instant serverTime) {
      return new AgentOutgoingMessage(
          TYPE_PONG,
          "keepalive acknowledged",
          null,
          serverTime.toString()
      );
    }
  }
}
