package com.ssafer.agent.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import com.ssafer.agent.domain.enums.AgentTaskType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class AgentTaskAvailableNotificationServiceTest {

  @Mock
  private AgentSessionRegistry agentSessionRegistry;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private AgentTaskAvailableNotificationService agentTaskAvailableNotificationService;

  @BeforeEach
  void setUp() {
    agentTaskAvailableNotificationService = new AgentTaskAvailableNotificationService(objectMapper, agentSessionRegistry);
  }

  @Test
  void notifyTaskAvailableSendsMinimalWebSocketMessage() throws Exception {
    AgentTaskAvailableRequestedEvent event = new AgentTaskAvailableRequestedEvent(
        501L,
        701L,
        AgentTaskType.PATCH_APPLY,
        101L,
        1001L,
        2001L
    );
    when(agentSessionRegistry.sendCurrentSessionMessage(eq(501L), org.mockito.ArgumentMatchers.any(TextMessage.class)))
        .thenReturn(true);

    agentTaskAvailableNotificationService.notifyTaskAvailable(event);

    ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
    verify(agentSessionRegistry).sendCurrentSessionMessage(eq(501L), messageCaptor.capture());

    JsonNode payload = objectMapper.readTree(messageCaptor.getValue().getPayload());
    assertThat(payload.get("type").asText()).isEqualTo("TASK_AVAILABLE");
    assertThat(payload.get("data").get("taskId").asLong()).isEqualTo(701L);
    assertThat(payload.get("data").get("taskType").asText()).isEqualTo("PATCH_APPLY");
    assertThat(payload.get("data").get("projectId").asLong()).isEqualTo(101L);
    assertThat(payload.get("data").get("scanId").asLong()).isEqualTo(1001L);
    assertThat(payload.get("data").get("findingId").asLong()).isEqualTo(2001L);
  }
}
