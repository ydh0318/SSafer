package com.ssafer.scan.application.service;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
@RequiredArgsConstructor
// 워커 완료 콜백 이후 S3 분석 결과를 읽고 적재 시작 상태로 전환하는 준비 job이다.
public class WorkerAnalysisResultIngestionJob {

  static final String INGESTING_PROGRESS_STEP = "INGESTING_ANALYSIS_RESULT";

  private final AnalysisResultObjectReader analysisResultObjectReader;
  private final ObjectMapper objectMapper;

  public void start(
      Scan scan,
      AgentTask agentTask,
      WorkerAnalysisResultCallbackRequest request,
      LocalDateTime startedAt,
      LocalDateTime lastUpdatedAt
  ) {
    String analysisResultJson = loadAnalysisResultJson(request.analysisResultPath());

    markTaskRunning(agentTask);
    scan.markAnalysisResultIngestionRunning(
        resolveProgressStep(request.progressStep()),
        request.analysisResultPath(),
        startedAt,
        lastUpdatedAt
    );

    log.info(
        "Worker analysis result accepted for ingestion: scanId={}, taskId={}, status={}, analysisResultSize={}",
        scan.getId(),
        agentTask.getId(),
        scan.getStatus(),
        analysisResultJson.length()
    );
  }

  private String loadAnalysisResultJson(String analysisResultPath) {
    try {
      String analysisResultJson = analysisResultObjectReader.read(analysisResultPath);
      objectMapper.readTree(analysisResultJson);
      return analysisResultJson;
    } catch (Exception ex) {
      log.error("Failed to load analysis result object: analysisResultPath={}", analysisResultPath, ex);
      throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to load analysis result object");
    }
  }

  private void markTaskRunning(AgentTask agentTask) {
    Instant now = Instant.now();
    if (agentTask.getTaskStatus() == AgentTaskStatus.SENT) {
      agentTask.markAcked(now);
    }
    if (agentTask.getTaskStatus() == AgentTaskStatus.ACKED) {
      agentTask.markRunning(now);
    }
  }

  private String resolveProgressStep(String progressStep) {
    return progressStep != null && !progressStep.isBlank()
        ? progressStep
        : INGESTING_PROGRESS_STEP;
  }
}
