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
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class WebUploadScanProcessorImplTest {

  @Mock
  private UploadScanTempWorkspaceManager tempWorkspaceManager;
  @Mock
  private UploadFileScanner uploadFileScanner;
  @Mock
  private UploadScanFindingPatchContextEnricher uploadScanFindingPatchContextEnricher;
  @Mock
  private ScanResultJsonBuilder scanResultJsonBuilder;
  @Mock
  private UploadScanRawResultUploader uploadScanRawResultUploader;
  @Mock
  private UploadScanAnalysisTaskDispatcher uploadScanAnalysisTaskDispatcher;
  @Mock
  private UploadScanStatusUpdater uploadScanStatusUpdater;
  @Mock
  private UploadScanToolMetadata uploadScanToolMetadata;

  @InjectMocks
  private WebUploadScanProcessorImpl processor;

  @TempDir
  Path tempDir;

  @Test
  void processRunsEndToEndAndReturnsQueued() throws Exception {
    // 정상 경로: temp 저장 -> 점검 -> json 생성 -> S3 업로드 -> MQ 발행 -> QUEUED 전이
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = tempDir.resolve("scan_result.json");
    String rawResultPath = "s3://ssafer/raw/1001/uuid/scan_result.json";
    Files.writeString(output, "{\"findings\":[1,2]}", StandardCharsets.UTF_8);

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    List<UploadScanFinding> scannedFindings = List.of(
        new UploadScanFinding("FND-0001", "ENV_PLAIN_SECRET", "custom-rule", "HIGH", ".env", 1, "secret", "DB_PASSWORD=***MASKED***")
    );
    when(uploadFileScanner.scanAll(List.of(file)))
        .thenReturn(new UploadFileScanResult(scannedFindings, List.of(), null, null, null));
    when(scanResultJsonBuilder.writeScanResultJson(
        any(),
        any(),
        any(),
        any(UploadFileScanResult.class)
    )).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output)).thenReturn(rawResultPath);
    when(uploadScanToolMetadata.toolName()).thenReturn("ssafer-web-upload");
    when(uploadScanToolMetadata.toolVersion()).thenReturn("0.1.0");

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.QUEUED);
    verify(uploadScanStatusUpdater).markRawUploaded(1001L, rawResultPath);
    ArgumentCaptor<String> payloadHashCaptor = ArgumentCaptor.forClass(String.class);
    verify(uploadScanAnalysisTaskDispatcher).dispatch(
        org.mockito.ArgumentMatchers.eq(1001L),
        org.mockito.ArgumentMatchers.eq(2001L),
        org.mockito.ArgumentMatchers.eq(rawResultPath),
        org.mockito.ArgumentMatchers.eq(1),
        org.mockito.ArgumentMatchers.eq("ssafer-web-upload"),
        org.mockito.ArgumentMatchers.eq("0.1.0"),
        payloadHashCaptor.capture()
    );
    // MQ payloadHash는 실제 scan_result.json bytes 기준 SHA-256과 동일해야 한다.
    assertThat(payloadHashCaptor.getValue()).isEqualTo(calculatePayloadHash(output));
    verify(uploadScanStatusUpdater).markQueued(1001L);
    verify(uploadScanStatusUpdater, never()).markExecutionFailed(any(), any());
    verify(uploadScanFindingPatchContextEnricher, never()).enrich(any(), any());
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processEnrichesPatchContextOnlyWhenFallbackIsAllowed() throws Exception {
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve("Dockerfile");
    Path output = tempDir.resolve("scan_result-fallback.json");
    String rawResultPath = "s3://ssafer/raw/1001/uuid/scan_result.json";
    Files.writeString(output, "{\"findings\":[1]}", StandardCharsets.UTF_8);

    List<UploadScanFinding> scannedFindings = List.of(
        new UploadScanFinding("FND-0001", "DOCKERFILE_ROOT_USER", "custom-rule", "MEDIUM", "Dockerfile", 3, "root", "USER root")
    );
    List<UploadScanFinding> enrichedFindings = List.of(
        new UploadScanFinding(
            "FND-0001",
            "DOCKERFILE_ROOT_USER",
            "custom-rule",
            "MEDIUM",
            "Dockerfile",
            3,
            "root",
            "USER root",
            "Dockerfile",
            new UploadScanFindingPatchContext("USER root", 3, 3, "sha256:abc123")
        )
    );

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(uploadFileScanner.scanAll(List.of(file)))
        .thenReturn(new UploadFileScanResult(scannedFindings, List.of(), null, null, null, true));
    when(uploadScanFindingPatchContextEnricher.enrich(scannedFindings, List.of(file))).thenReturn(enrichedFindings);
    when(scanResultJsonBuilder.writeScanResultJson(
        any(),
        any(),
        any(),
        any(UploadFileScanResult.class)
    )).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output)).thenReturn(rawResultPath);
    when(uploadScanToolMetadata.toolName()).thenReturn("ssafer-web-upload");
    when(uploadScanToolMetadata.toolVersion()).thenReturn("0.1.0");

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.QUEUED);
    verify(uploadScanFindingPatchContextEnricher).enrich(scannedFindings, List.of(file));
    ArgumentCaptor<UploadFileScanResult> scanResultCaptor = ArgumentCaptor.forClass(UploadFileScanResult.class);
    verify(scanResultJsonBuilder).writeScanResultJson(
        org.mockito.ArgumentMatchers.eq(workspace),
        org.mockito.ArgumentMatchers.eq(1001L),
        org.mockito.ArgumentMatchers.eq("project-a"),
        scanResultCaptor.capture()
    );
    assertThat(scanResultCaptor.getValue().findings()).isEqualTo(enrichedFindings);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenExecutionFailsReturnsExecutionFailure() {
    // 1차 점검 단계 예외는 SCAN_EXECUTION_FAILED로 수렴되어야 한다.
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(uploadFileScanner.scanAll(List.of(file))).thenThrow(new IllegalStateException("scan failed"));

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.FAILED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.SCAN_EXECUTION_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.SCAN_EXECUTION_FAILED);
    verify(uploadScanStatusUpdater).markExecutionFailed(1001L, ScanFailureReason.SCAN_EXECUTION_FAILED);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  @Test
  void processWhenS3UploadFailsReturnsRawUploadFailure() throws Exception {
    // raw 결과 업로드 실패 시 FAILED + RAW_RESULT_UPLOAD_FAILED로 반환되어야 한다.
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = tempDir.resolve("scan_result-upload-fail.json");
    Files.writeString(output, "{\"findings\":[]}", StandardCharsets.UTF_8);

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(uploadFileScanner.scanAll(List.of(file)))
        .thenReturn(new UploadFileScanResult(List.of(), List.of(), null, null, null));
    when(scanResultJsonBuilder.writeScanResultJson(
        any(),
        any(),
        any(),
        any(UploadFileScanResult.class)
    )).thenReturn(output);
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
  void processWhenQueuePublishFailsReturnsRawUploadedFailure() throws Exception {
    // MQ 발행 실패 시 RAW_UPLOADED 상태를 유지하고 failureReason만 기록해야 한다.
    UploadScanProcessingCommand command = command();
    Path workspace = Path.of("C:/tmp/upload-scan");
    Path file = workspace.resolve(".env");
    Path output = tempDir.resolve("scan_result-queue-fail.json");
    String rawResultPath = "s3://ssafer/raw/1001/uuid/scan_result.json";
    Files.writeString(output, "{\"findings\":[]}", StandardCharsets.UTF_8);

    when(tempWorkspaceManager.createWorkspace(1001L)).thenReturn(workspace);
    when(tempWorkspaceManager.saveFiles(any(), any())).thenReturn(List.of(file));
    when(uploadFileScanner.scanAll(List.of(file)))
        .thenReturn(new UploadFileScanResult(List.of(), List.of(), null, null, null));
    when(scanResultJsonBuilder.writeScanResultJson(
        any(),
        any(),
        any(),
        any(UploadFileScanResult.class)
    )).thenReturn(output);
    when(uploadScanRawResultUploader.upload(1001L, output)).thenReturn(rawResultPath);
    when(uploadScanToolMetadata.toolName()).thenReturn("ssafer-web-upload");
    when(uploadScanToolMetadata.toolVersion()).thenReturn("0.1.0");
    org.mockito.Mockito.doThrow(new UploadScanQueuePublishException("mq failed", new RuntimeException("boom")))
        .when(uploadScanAnalysisTaskDispatcher)
        .dispatch(
            org.mockito.ArgumentMatchers.eq(1001L),
            org.mockito.ArgumentMatchers.eq(2001L),
            org.mockito.ArgumentMatchers.eq(rawResultPath),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString()
        );

    UploadScanProcessingResult result = processor.process(command);

    assertThat(result.status()).isEqualTo(ScanStatus.RAW_UPLOADED);
    assertThat(result.failureReason()).isEqualTo(ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    assertThat(result.errorCode()).isEqualTo(ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(uploadScanStatusUpdater).markRawUploaded(1001L, rawResultPath);
    verify(uploadScanStatusUpdater).markQueuePublishFailed(1001L, ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED);
    verify(tempWorkspaceManager).cleanup(workspace);
  }

  private UploadScanProcessingCommand command() {
    // 업로드 처리 command 기본 fixture
    MockMultipartFile file = new MockMultipartFile(
        "files",
        ".env",
        "text/plain",
        "DB_PASSWORD=plain".getBytes(StandardCharsets.UTF_8)
    );
    return new UploadScanProcessingCommand(1001L, 2001L, "project-a", "upload-scan", List.of(file));
  }

  private String calculatePayloadHash(Path path) throws Exception {
    // 운영 코드와 동일하게 파일 bytes SHA-256을 계산해 비교한다.
    byte[] content = Files.readAllBytes(path);
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hashed = digest.digest(content);

    StringBuilder builder = new StringBuilder(hashed.length * 2);
    for (byte value : hashed) {
      builder.append(String.format("%02x", value));
    }
    return "sha256:" + builder;
  }
}
