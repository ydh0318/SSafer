package com.ssafer.agent.ws;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
@RequiredArgsConstructor
// ONLINE agent 세션이 있으면 짧은 task available 알림만 보내고 실제 payload는 기존 HTTP pull로 조회시킨다.
public class AgentTaskAvailableNotificationService {

  private static final String TYPE_TASK_AVAILABLE = "TASK_AVAILABLE";

  private final ObjectMapper objectMapper;
  private final AgentSessionRegistry sessionRegistry;

  public boolean notifyTaskAvailable(AgentTaskAvailableRequestedEvent event) {
    try {
      String payload = objectMapper.writeValueAsString(new AgentOutgoingMessage(
          TYPE_TASK_AVAILABLE,
          "새 agent task가 준비되었습니다.",
          buildData(event),
          null
      ));

      boolean sent = sessionRegistry.sendCurrentSessionMessage(event.agentId(), new TextMessage(payload));
      if (!sent) {
        log.debug("Task available notification skipped because agent session is not online: agentId={}, taskId={}",
            event.agentId(),
            event.taskId());
      }
      return sent;
    } catch (IOException ex) {
      log.warn("Failed to send task available notification: agentId={}, taskId={}", event.agentId(), event.taskId(), ex);
    } catch (Exception ex) {
      log.warn("Failed to build task available notification: agentId={}, taskId={}", event.agentId(), event.taskId(), ex);
    }
    return false;
  }

  private Map<String, Object> buildData(AgentTaskAvailableRequestedEvent event) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("taskId", event.taskId());
    data.put("taskType", event.taskType());
    data.put("projectId", event.projectId());
    data.put("scanId", event.scanId());
    data.put("findingId", event.findingId());
    return data;
  }

  private record AgentOutgoingMessage(
      String type,
      String message,
      Map<String, Object> data,
      String serverTime
  ) {
  }
}
