package com.ssafer.scan.application.service;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkerAnalysisResultIngestionJobTest {

  @Mock
  private WorkerAnalysisResultPersistenceService workerAnalysisResultPersistenceService;

  @InjectMocks
  private WorkerAnalysisResultIngestionJob workerAnalysisResultIngestionJob;

  @Test
  void ingestWhenPersistenceFailsMarksFailureInNewTransaction() {
    WorkerAnalysisResultIngestionRequestedEvent event =
        new WorkerAnalysisResultIngestionRequestedEvent(1L, 100L, LocalDateTime.now(), LocalDateTime.now());
    IllegalStateException failure = new IllegalStateException("s3 read failed");
    doThrow(failure).when(workerAnalysisResultPersistenceService).persist(event);

    workerAnalysisResultIngestionJob.ingest(event);

    verify(workerAnalysisResultPersistenceService).persist(event);
    verify(workerAnalysisResultPersistenceService).markFailed(event, failure);
  }
}
