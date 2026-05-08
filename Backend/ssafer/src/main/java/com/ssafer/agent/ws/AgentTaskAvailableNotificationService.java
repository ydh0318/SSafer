package com.ssafer.agent.ws;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import java.io.IOException;
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

  public void notifyTaskAvailable(AgentTaskAvailableRequestedEvent event) {
    try {
      String payload = objectMapper.writeValueAsString(new AgentOutgoingMessage(
          TYPE_TASK_AVAILABLE,
          "새 agent task가 준비되었습니다.",
          Map.of(
              "taskId", event.taskId(),
              "taskType", event.taskType(),
              "projectId", event.projectId(),
              "scanId", event.scanId(),
              "findingId", event.findingId()
          ),
          null
      ));

      boolean sent = sessionRegistry.sendCurrentSessionMessage(event.agentId(), new TextMessage(payload));
      if (!sent) {
        log.debug("Task available notification skipped because agent session is not online: agentId={}, taskId={}",
            event.agentId(),
            event.taskId());
      }
    } catch (IOException ex) {
      log.warn("Failed to send task available notification: agentId={}, taskId={}", event.agentId(), event.taskId(), ex);
    } catch (Exception ex) {
      log.warn("Failed to build task available notification: agentId={}, taskId={}", event.agentId(), event.taskId(), ex);
    }
  }

  private record AgentOutgoingMessage(
      String type,
      String message,
      Map<String, Object> data,
      String serverTime
  ) {
  }
}
