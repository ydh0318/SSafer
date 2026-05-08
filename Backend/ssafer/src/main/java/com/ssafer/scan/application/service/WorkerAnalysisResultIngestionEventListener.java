package com.ssafer.scan.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
// 콜백 트랜잭션이 커밋된 뒤 분석 결과 적재 job을 비동기로 실행한다.
public class WorkerAnalysisResultIngestionEventListener {

  private final WorkerAnalysisResultIngestionJob workerAnalysisResultIngestionJob;

  @Async
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onRequested(WorkerAnalysisResultIngestionRequestedEvent event) {
    workerAnalysisResultIngestionJob.ingest(event);
  }
}
