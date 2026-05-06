package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultCallbackServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private AgentTaskRepository agentTaskRepository;

  @Mock
  private WorkerAnalysisResultIngestionJob workerAnalysisResultIngestionJob;

  @InjectMocks
  private WorkerAnalysisResultCallbackService workerAnalysisResultCallbackService;

  @Test
  void reportDoneStatusStartsIngestionJob() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(requestedAt)
        .startedAt(requestedAt.plusMinutes(1))
        .lastUpdatedAt(requestedAt.plusMinutes(2))
        .build();
    AgentTask agentTask = org.mockito.Mockito.mock(AgentTask.class);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(existing));
    when(agentTaskRepository.findByIdAndScanId(100L, 1L)).thenReturn(Optional.of(agentTask));
    when(agentTask.getTaskType()).thenReturn(AgentTaskType.SCAN_REQUEST);
    when(agentTask.getTaskStatus()).thenReturn(AgentTaskStatus.SENT);

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        "analysis_completed",
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null);

    Scan saved = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(saved).isSameAs(existing);
    verify(workerAnalysisResultIngestionJob).start(
        org.mockito.ArgumentMatchers.same(existing),
        org.mockito.ArgumentMatchers.same(agentTask),
        org.mockito.ArgumentMatchers.same(request),
        org.mockito.ArgumentMatchers.any(LocalDateTime.class),
        org.mockito.ArgumentMatchers.any(LocalDateTime.class)
    );
  }

  @Test
  void reportFailedStatusMarksTaskAndScanFailed() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 24, 15, 0);
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .requestedAt(requestedAt)
        .startedAt(requestedAt.plusMinutes(1))
        .lastUpdatedAt(requestedAt.plusMinutes(2))
        .build();
    AgentTask agentTask = org.mockito.Mockito.mock(AgentTask.class);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(existing));
    when(agentTaskRepository.findByIdAndScanId(100L, 1L)).thenReturn(Optional.of(agentTask));
    when(agentTask.getTaskType()).thenReturn(AgentTaskType.SCAN_REQUEST);
    when(agentTask.getTaskStatus()).thenReturn(AgentTaskStatus.RUNNING);

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.FAILED,
        "analysis_failed",
        "worker analysis failed",
        null,
        null,
        null,
        null);

    Scan saved = workerAnalysisResultCallbackService.report(1L, request);

    assertThat(saved.getStatus()).isEqualTo(ScanStatus.FAILED);
    assertThat(saved.getFailureReason()).isEqualTo("worker analysis failed");
    verify(agentTask).markFailed(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq("worker analysis failed"));
  }

  @Test
  void reportDoneStatusWithoutAnalysisResultPathThrowsBadRequest() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();
    AgentTask agentTask = org.mockito.Mockito.mock(AgentTask.class);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(existing));
    when(agentTaskRepository.findByIdAndScanId(100L, 1L)).thenReturn(Optional.of(agentTask));
    when(agentTask.getTaskType()).thenReturn(AgentTaskType.SCAN_REQUEST);
    when(agentTask.getTaskStatus()).thenReturn(AgentTaskStatus.SENT);

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        null,
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(BAD_REQUEST);
  }

  @Test
  void reportWhenScanMissingThrowsNotFound() {
    when(scanRepository.findByIdForUpdate(999L)).thenReturn(Optional.empty());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        999L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/999/analysis_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(999L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void reportWhenTaskMissingThrowsNotFound() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.QUEUED)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(existing));
    when(agentTaskRepository.findByIdAndScanId(100L, 1L)).thenReturn(Optional.empty());

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(NOT_FOUND);
  }

  @Test
  void reportWhenScanIsTerminalThrowsConflict() {
    Scan existing = Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 24, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 24, 15, 5))
        .build();
    AgentTask agentTask = org.mockito.Mockito.mock(AgentTask.class);

    when(scanRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(existing));
    when(agentTaskRepository.findByIdAndScanId(100L, 1L)).thenReturn(Optional.of(agentTask));

    WorkerAnalysisResultCallbackRequest request = new WorkerAnalysisResultCallbackRequest(
        100L,
        ScanStatus.DONE,
        null,
        null,
        "s3://ssafer/result/1/analysis_result.json",
        null,
        null,
        null);

    assertThatThrownBy(() -> workerAnalysisResultCallbackService.report(1L, request))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(CONFLICT);
  }
}
