package com.ssafer.agent.domain.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.Instant;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class AgentTaskTest {

  @Test
  void markMethodsFollowLifecycle() {
    AgentTask task = createTask();

    task.markSent(Instant.parse("2026-05-06T04:00:00Z"));
    task.markAcked(Instant.parse("2026-05-06T04:00:10Z"));
    task.markRunning(Instant.parse("2026-05-06T04:00:20Z"));
    task.markSucceeded(Instant.parse("2026-05-06T04:00:30Z"));

    assertThat(task.getTaskStatus()).isEqualTo(AgentTaskStatus.SUCCEEDED);
    assertThat(task.getSentAt()).isEqualTo(Instant.parse("2026-05-06T04:00:00Z"));
    assertThat(task.getAckedAt()).isEqualTo(Instant.parse("2026-05-06T04:00:10Z"));
    assertThat(task.getStartedAt()).isEqualTo(Instant.parse("2026-05-06T04:00:20Z"));
    assertThat(task.getCompletedAt()).isEqualTo(Instant.parse("2026-05-06T04:00:30Z"));
  }

  @Test
  void invalidTransitionThrowsException() {
    AgentTask task = createTask();

    assertThatThrownBy(() -> task.markRunning(Instant.parse("2026-05-06T04:00:20Z")))
        .isInstanceOf(IllegalStateException.class);
  }

  private AgentTask createTask() {
    Project project = new Project(1L, null, "project-a", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    Scan scan = Scan.builder()
        .projectId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();
    return new AgentTask(agent, project, scan, null, AgentTaskType.SCAN_REQUEST, AgentTaskStatus.PENDING, null);
  }
}
