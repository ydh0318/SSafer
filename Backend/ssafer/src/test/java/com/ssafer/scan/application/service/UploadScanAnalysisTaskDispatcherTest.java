package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class UploadScanAnalysisTaskDispatcherTest {

  @Mock
  private ProjectRepository projectRepository;
  @Mock
  private ScanRepository scanRepository;
  @Mock
  private AgentRepository agentRepository;
  @Mock
  private AgentTaskRepository agentTaskRepository;
  @Mock
  private AgentTaskPublisher agentTaskPublisher;
  @Mock
  private ObjectMapper objectMapper;

  @InjectMocks
  private UploadScanAnalysisTaskDispatcher dispatcher;

  @Test
  void dispatchPublishesMessageWithUploadMetadata() throws Exception {
    Project project = new Project(1L, null, "project-a", null, com.ssafer.project.domain.enums.ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 2001L);

    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(2001L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.UPLOAD)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.RAW_UPLOADED)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();

    Agent agent = new Agent(project, AgentStatus.OFFLINE, true);
    ReflectionTestUtils.setField(agent, "id", 3001L);

    when(projectRepository.findById(2001L)).thenReturn(Optional.of(project));
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(agentRepository.findFirstByProjectId(2001L)).thenReturn(Optional.of(agent));
    when(agentTaskRepository.save(any(AgentTask.class))).thenAnswer(invocation -> {
      AgentTask saved = invocation.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 4001L);
      ReflectionTestUtils.setField(saved, "queuedAt", Instant.parse("2026-05-08T05:10:00Z"));
      return saved;
    });
    when(objectMapper.writeValueAsString(any())).thenReturn("{\"messageType\":\"SCAN_REQUEST\"}");

    dispatcher.dispatch(
        1001L,
        2001L,
        "s3://ssafer/raw/1001/uuid/scan_result.json",
        12,
        "ssafer-web-upload",
        "0.1.0",
        "sha256:abc123"
    );

    ArgumentCaptor<ScanRequestTaskMessage> messageCaptor = ArgumentCaptor.forClass(ScanRequestTaskMessage.class);
    verify(agentTaskPublisher).publishScanRequest(messageCaptor.capture());
    ScanRequestTaskMessage message = messageCaptor.getValue();

    assertThat(message.scanId()).isEqualTo(1001L);
    assertThat(message.projectId()).isEqualTo(2001L);
    assertThat(message.scanType()).isEqualTo(ScanType.PROJECT_FILE);
    assertThat(message.rawResultPath()).isEqualTo("s3://ssafer/raw/1001/uuid/scan_result.json");
    assertThat(message.resultCount()).isEqualTo(12);
    assertThat(message.tool()).isEqualTo("ssafer-web-upload");
    assertThat(message.toolVersion()).isEqualTo("0.1.0");
    assertThat(message.payloadHash()).isEqualTo("sha256:abc123");
  }
}
