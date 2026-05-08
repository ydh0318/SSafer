package com.ssafer.agent.ws;

import static org.mockito.Mockito.verify;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import com.ssafer.agent.domain.enums.AgentTaskType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AgentTaskAvailableEventListenerTest {

  @Mock
  private AgentTaskAvailableNotificationService agentTaskAvailableNotificationService;

  @InjectMocks
  private AgentTaskAvailableEventListener agentTaskAvailableEventListener;

  @Test
  void onTaskAvailableDelegatesToNotificationService() {
    AgentTaskAvailableRequestedEvent event = new AgentTaskAvailableRequestedEvent(
        501L,
        701L,
        AgentTaskType.PATCH_APPLY,
        101L,
        1001L,
        2001L
    );

    agentTaskAvailableEventListener.onTaskAvailable(event);

    verify(agentTaskAvailableNotificationService).notifyTaskAvailable(event);
  }
}
