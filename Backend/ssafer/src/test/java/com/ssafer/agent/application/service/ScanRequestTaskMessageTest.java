package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import java.time.Instant;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ScanRequestTaskMessageTest {

  @Test
  void ofBuildsVersionedScanRequestMessage() {
    Project project = new Project(1L, null, "project-a", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 10L);

    Agent agent = new Agent(project, AgentStatus.ONLINE);
    ReflectionTestUtils.setField(agent, "id", 20L);

    Scan scan = Scan.builder()
        .id(30L)
        .projectId(project.getId())
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .scanType(ScanType.SERVER_AUDIT)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();

    AgentTask task = new AgentTask(agent, project, scan, null, AgentTaskType.SCAN_REQUEST, AgentTaskStatus.PENDING, null);
    ReflectionTestUtils.setField(task, "id", 40L);
    ReflectionTestUtils.setField(task, "queuedAt", Instant.parse("2026-05-06T04:00:00Z"));

    ScanRequestTaskMessage message = ScanRequestTaskMessage.of(
        task,
        "s3://ssafer/raw/30/scan_result.json",
        152,
        "ssafer-cli",
        "1.4.0",
        "sha256:abc"
    );

    assertThat(message.messageType()).isEqualTo("SCAN_REQUEST");
    assertThat(message.messageVersion()).isEqualTo(2);
    assertThat(message.taskType()).isEqualTo(AgentTaskType.SCAN_REQUEST);
    assertThat(message.taskId()).isEqualTo(40L);
    assertThat(message.agentId()).isEqualTo(20L);
    assertThat(message.projectId()).isEqualTo(10L);
    assertThat(message.scanId()).isEqualTo(30L);
    assertThat(message.scanType()).isEqualTo(ScanType.SERVER_AUDIT);
    assertThat(message.rawResultPath()).isEqualTo("s3://ssafer/raw/30/scan_result.json");
    assertThat(message.resultCount()).isEqualTo(152);
    assertThat(message.tool()).isEqualTo("ssafer-cli");
    assertThat(message.toolVersion()).isEqualTo("1.4.0");
    assertThat(message.payloadHash()).isEqualTo("sha256:abc");
    assertThat(message.queuedAt()).isEqualTo(Instant.parse("2026-05-06T04:00:00Z"));
  }
}
