package com.ssafer.agent.ws;

import static org.mockito.Mockito.verify;

import com.ssafer.agent.application.service.AgentConnectionService;
import java.time.Instant;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AgentHeartbeatSchedulerTest {

  @Mock
  private AgentConnectionService agentConnectionService;

  @Test
  void markHeartbeatTimedOutAgentsOfflineCallsServiceWithTimeoutCutoff() {
    AgentHeartbeatProperties properties = new AgentHeartbeatProperties();
    properties.setTimeoutSeconds(90);

    AgentHeartbeatScheduler scheduler = new AgentHeartbeatScheduler(agentConnectionService, properties);
    scheduler.markHeartbeatTimedOutAgentsOffline();

    ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
    ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
    verify(agentConnectionService).markTimedOutAgentsOffline(
        cutoffCaptor.capture(),
        nowCaptor.capture()
    );

    Instant cutoff = cutoffCaptor.getValue();
    Instant now = nowCaptor.getValue();
    Assertions.assertThat(cutoff).isEqualTo(now.minusSeconds(90));
  }
}
