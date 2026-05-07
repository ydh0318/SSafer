package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
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
  private UploadScanStatusUpdater uploadScanStatusUpdater;

  @InjectMocks
  private WebUploadScanProcessorImpl processor;

  @Test
  void processRunsScannersAndWritesScanResult() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = workspace.resolve("scan_result.json");

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenReturn(List.of(
        new UploadScanFinding("FND-0001", "ENV_PLAIN_SECRET", "custom-rule", "HIGH", ".env", 1, "secret", "DB_PASSWORD=***MASKED***")
    ));
    when(trivyScanExecutor.scan(List.of(file))).thenReturn(List.of());
    when(scanResultJsonBuilder.writeScanResultJson(any(), any(), any())).thenReturn(output);

    processor.process(command);

    verify(customRuleScanner).scan(List.of(file));
    verify(trivyScanExecutor).scan(List.of(file));
    verify(scanResultJsonBuilder).writeScanResultJson(any(), any(), any());
    verify(uploadScanStatusUpdater, never()).markExecutionFailed(any(), any());
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenExecutionFailsMarksScanFailedAndThrowsBusinessException() {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(customRuleScanner.scan(List.of(file))).thenThrow(new IllegalStateException("scan failed"));

    assertThatThrownBy(() -> processor.process(command))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.SCAN_EXECUTION_FAILED);

    verify(uploadScanStatusUpdater).markExecutionFailed(1001L, ScanFailureReason.SCAN_EXECUTION_FAILED);
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
