package com.ssafer.agent.ws;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

@Component
public class AgentSessionRegistry {

  // 동일 agentId에는 항상 "현재 유효 세션 1개"만 유지한다.
  private final Map<Long, SessionRef> agentSessions = new ConcurrentHashMap<>();
  // close 이벤트 처리 시 sessionId -> agentId 역참조가 필요하다.
  private final Map<String, Long> sessionToAgent = new ConcurrentHashMap<>();

  public SessionRef register(Long agentId, WebSocketSession session) throws IOException {
    SessionRef next = new SessionRef(session.getId(), session);
    SessionRef previous = agentSessions.put(agentId, next);
    sessionToAgent.put(session.getId(), agentId);

    // 재연결로 기존 세션이 남아 있으면 종료하고 새 세션으로 대체한다.
    if (previous != null && !previous.sessionId().equals(session.getId()) && previous.session().isOpen()) {
      previous.session().close(CloseStatus.SESSION_NOT_RELIABLE);
    }
    return previous;
  }

  public boolean closeCurrentSession(Long agentId, CloseStatus closeStatus) throws IOException {
    SessionRef current = agentSessions.get(agentId);
    if (current == null || current.session() == null || !current.session().isOpen()) {
      return false;
    }
    current.session().close(closeStatus);
    return true;
  }

  public Long findAgentIdBySessionId(String sessionId) {
    return sessionToAgent.get(sessionId);
  }

  public boolean isCurrentSession(Long agentId, String sessionId) {
    SessionRef current = agentSessions.get(agentId);
    return current != null && current.sessionId().equals(sessionId);
  }

  public boolean removeIfCurrent(Long agentId, String sessionId) {
    sessionToAgent.remove(sessionId);
    return agentSessions.remove(agentId, new SessionRef(sessionId, null));
  }

  public void removeSessionBinding(String sessionId) {
    sessionToAgent.remove(sessionId);
  }

  public record SessionRef(String sessionId, WebSocketSession session) {
    @Override
    public boolean equals(Object obj) {
      if (this == obj) {
        return true;
      }
      if (!(obj instanceof SessionRef other)) {
        return false;
      }
      return sessionId.equals(other.sessionId);
    }

    @Override
    public int hashCode() {
      return sessionId.hashCode();
    }
  }
}
