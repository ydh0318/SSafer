package com.ssafer.agent.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AgentTaskStatusTest {

  @Test
  void resendTargetStatusesContainOnlyIncompleteStatuses() {
    assertThat(AgentTaskStatus.resendTargetStatuses())
        .containsExactlyInAnyOrder(
            AgentTaskStatus.PENDING,
            AgentTaskStatus.SENT,
            AgentTaskStatus.ACKED,
            AgentTaskStatus.RUNNING
        );
  }

  @Test
  void terminalAndResendTargetFlagsAreConsistent() {
    assertThat(AgentTaskStatus.PENDING.isResendTarget()).isTrue();
    assertThat(AgentTaskStatus.RUNNING.isResendTarget()).isTrue();
    assertThat(AgentTaskStatus.SUCCEEDED.isResendTarget()).isFalse();
    assertThat(AgentTaskStatus.CANCELED.isResendTarget()).isFalse();

    assertThat(AgentTaskStatus.SUCCEEDED.isTerminal()).isTrue();
    assertThat(AgentTaskStatus.FAILED.isTerminal()).isTrue();
    assertThat(AgentTaskStatus.CANCELED.isTerminal()).isTrue();
    assertThat(AgentTaskStatus.ACKED.isTerminal()).isFalse();
  }
}
