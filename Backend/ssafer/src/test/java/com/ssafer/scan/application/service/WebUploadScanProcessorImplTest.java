package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class WebUploadScanProcessorImplTest {

  @Mock
  private UploadScanTempWorkspaceManager tempWorkspaceManager;
  @Mock
  private CustomRuleScanner customRuleScanner;
  @Mock
  private TrivyScanExecutor trivyScanExecutor;
  @Mock
  private ScanResultJsonBuilder scanResultJsonBuilder;
  @Mock
  private UploadScanRawResultUploader uploadScanRawResultUploader;
  @Mock
  private UploadScanAnalysisTaskDispatcher uploadScanAnalysisTaskDispatcher;
  @Mock
  private UploadScanStatusUpdater uploadScanStatusUpdater;

  @InjectMocks
  private WebUploadScanProcessorImpl processor;

  @Test
  void processRunsEndToEndAndReturnsQueued() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = workspace.resolve("scan_result.json");
    String rawResultPath = "s3://ssafer/raw/1001/uuid/scan_result.json";

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenReturn(List.of(
        new UploadScanFinding("FND-0001", "ENV_PLAIN_SECRET", "custom-rule", "HIGH", ".env", 1, "secret", "DB_PASSWORD=***MASKED***")
    ));
    when(trivyScanExecutor.scan(List.of(file))).thenReturn(List.of());
    when(scanResultJsonBuilder.writeScanResultJson(any(), any(), any())).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output)).thenReturn(rawResultPath);

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.QUEUED);
    verify(uploadScanStatusUpdater).markRawUploaded(1001L, rawResultPath);
    verify(uploadScanAnalysisTaskDispatcher).dispatch(1001L, 2001L, rawResultPath);
    verify(uploadScanStatusUpdater).markQueued(1001L);
    verify(uploadScanStatusUpdater, never()).markExecutionFailed(any(), any());
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenExecutionFailsReturnsExecutionFailure() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenThrow(new IllegalStateException("scan failed"));

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.FAILED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.SCAN_EXECUTION_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.SCAN_EXECUTION_FAILED);
    verify(uploadScanStatusUpdater).markExecutionFailed(1001L, ScanFailureReason.SCAN_EXECUTION_FAILED);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenS3UploadFailsReturnsRawUploadFailure() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = workspace.resolve("scan_result.json");

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenReturn(List.of());
    when(trivyScanExecutor.scan(List.of(file))).thenReturn(List.of());
    when(scanResultJsonBuilder.writeScanResultJson(any(), any(), any())).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output))
        .thenThrow(new UploadScanS3UploadException("s3 failed", new RuntimeException("boom")));

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.FAILED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.RAW_RESULT_UPLOAD_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.RAW_RESULT_UPLOAD_FAILED);
    verify(uploadScanStatusUpdater).markUploadFailed(1001L, ScanFailureReason.RAW_RESULT_UPLOAD_FAILED);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenQueuePublishFailsReturnsRawUploadedFailure() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = workspace.resolve("scan_result.json");
    String rawResultPath = "s3://ssafer/raw/1001/uuid/scan_result.json";

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenReturn(List.of());
    when(trivyScanExecutor.scan(List.of(file))).thenReturn(List.of());
    when(scanResultJsonBuilder.writeScanResultJson(any(), any(), any())).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output)).thenReturn(rawResultPath);
    org.mockito.Mockito.doThrow(new UploadScanQueuePublishException("mq failed", new RuntimeException("boom")))
        .when(uploadScanAnalysisTaskDispatcher)
        .dispatch(1001L, 2001L, rawResultPath);

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(uploadScanStatusUpdater).markRawUploaded(1001L, rawResultPath);
    verify(uploadScanStatusUpdater).markQueuePublishFailed(1001L, ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  private UploadScanProcessingCommand command() {
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "DB_PASSWORD=plain".getBytes(StandardCharsets.UTF_8)
    );
    return new UploadScanProcessingCommand(1001L, 2001L, "upload-scan", List.of(file));
  }
}
