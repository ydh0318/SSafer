package com.ssafer.scan.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
// 비동기 적재 job 실행 중 예외를 격리하고 실패 상태 반영까지 마무리한다.
public class WorkerAnalysisResultIngestionJob {

  private final WorkerAnalysisResultPersistenceService workerAnalysisResultPersistenceService;

  public void ingest(WorkerAnalysisResultIngestionRequestedEvent event) {
    try {
      workerAnalysisResultPersistenceService.persist(event);
    } catch (Exception ex) {
      log.error(
          "Worker analysis result ingestion failed: scanId={}, taskId={}",
          event.scanId(),
          event.taskId(),
          ex
      );
      workerAnalysisResultPersistenceService.markFailed(event, ex);
    }
  }
}
