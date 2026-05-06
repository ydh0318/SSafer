package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultIngestionJobTest {

  @Mock
  private AnalysisResultObjectReader analysisResultObjectReader;

  private WorkerAnalysisResultIngestionJob workerAnalysisResultIngestionJob;

  @BeforeEach
  void setUp() {
    workerAnalysisResultIngestionJob = new WorkerAnalysisResultIngestionJob(
        analysisResultObjectReader,
        new ObjectMapper()
    );
  }

  @Test
  void startMarksTaskAndScanRunning() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 5, 6, 10, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(2);
    Scan scan = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .lastUpdatedAt(lastUpdatedAt)
        .build();
    Project project = new Project(20L, null, "test-project", null, ScanMode.AGENT, false);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    AgentTask agentTask = new AgentTask(agent, project, scan, null, AgentTaskType.SCAN_REQUEST, AgentTaskStatus.SENT, null);

    when(analysisResultObjectReader.read("s3://ssafer/result/1/analysis_result.json"))
        .thenReturn("{\"nodes\":[],\"findings\":[]}");

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        startedAt,
        null,
        lastUpdatedAt
    );

    workerAnalysisResultIngestionJob.start(scan, agentTask, request, startedAt, lastUpdatedAt);

    assertThat(agentTask.getTaskStatus()).isEqualTo(AgentTaskStatus.RUNNING);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.RUNNING);
    assertThat(scan.getAnalysisResultPath()).isEqualTo("s3://ssafer/result/1/analysis_result.json");
    assertThat(scan.getProgressStep()).isEqualTo(WorkerAnalysisResultIngestionJob.INGESTING_PROGRESS_STEP);
  }

  @Test
  void startWhenAnalysisResultCannotBeLoadedThrowsInternalServerError() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 5, 6, 10, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime lastUpdatedAt = requestedAt.plusMinutes(2);
    Scan scan = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .lastUpdatedAt(lastUpdatedAt)
        .build();
    Project project = new Project(20L, null, "test-project", null, ScanMode.AGENT, false);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    AgentTask agentTask = new AgentTask(agent, project, scan, null, AgentTaskType.SCAN_REQUEST, AgentTaskStatus.SENT, null);

    when(analysisResultObjectReader.read("s3://ssafer/result/1/analysis_result.json"))
        .thenThrow(new IllegalStateException("s3 read failed"));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        startedAt,
        null,
        lastUpdatedAt
    );

    assertThatThrownBy(() -> workerAnalysisResultIngestionJob.start(scan, agentTask, request, startedAt, lastUpdatedAt))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(INTERNAL_SERVER_ERROR);

    assertThat(agentTask.getTaskStatus()).isEqualTo(AgentTaskStatus.SENT);
    assertThat(scan.getStatus()).isEqualTo(ScanStatus.QUEUED);
  }
}
