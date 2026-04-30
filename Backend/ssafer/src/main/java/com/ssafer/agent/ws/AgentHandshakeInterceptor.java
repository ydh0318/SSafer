package com.ssafer.agent.ws;

import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
public class AgentHandshakeInterceptor implements HandshakeInterceptor {

  public static final String AUTHORIZATION_ATTR = "agentWsAuthorization";

  @Override
  public boolean beforeHandshake(
      ServerHttpRequest request,
      ServerHttpResponse response,
      WebSocketHandler wsHandler,
      Map<String, Object> attributes
  ) {
    // Tomcat에서 request 재사용 이슈를 피하기 위해 인증 헤더를 세션 attribute로 복사해 둔다.
    String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
    if (authorization != null) {
      attributes.put(AUTHORIZATION_ATTR, authorization);
    }
    return true;
  }

  @Override
  public void afterHandshake(
      ServerHttpRequest request,
      ServerHttpResponse response,
      WebSocketHandler wsHandler,
      Exception exception
  ) {
    // no-op
  }
}
