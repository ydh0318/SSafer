package com.ssafer.scan.application.service;

import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebUploadScanProcessorImpl implements WebUploadScanProcessor {

  private final UploadScanTempWorkspaceManager tempWorkspaceManager;
  private final UploadFileScanner uploadFileScanner;
  private final UploadScanFindingPatchContextEnricher uploadScanFindingPatchContextEnricher;
  private final ScanResultJsonBuilder scanResultJsonBuilder;
  private final UploadScanRawResultUploader uploadScanRawResultUploader;
  private final UploadScanAnalysisTaskDispatcher uploadScanAnalysisTaskDispatcher;
  private final UploadScanStatusUpdater uploadScanStatusUpdater;
  private final UploadScanToolMetadata uploadScanToolMetadata;

  @Override
  public UploadScanProcessingResult process(UploadScanProcessingCommand command) {
    // 업로드 스캔 처리 순서:
    // temp 저장 -> 스캔 실행(engine 또는 fallback) -> scan_result.json 생성 -> S3 업로드 -> MQ 발행 -> 상태 전이
    Path workspace = null;
    try {
      workspace = tempWorkspaceManager.createWorkspace(command.scanId());
      List<Path> savedFiles = tempWorkspaceManager.saveFiles(workspace, command.files());

      // 스캔 실행 방식은 UploadFileScanner 구현체가 결정하고, 이후 결과 처리 흐름은 이 클래스가 유지한다.
      // 웹 업로드는 로컬 경로를 모르므로, 저장된 업로드 파일에서 diff용 patchContext만 보강한다.
      List<UploadScanFinding> findings = uploadScanFindingPatchContextEnricher.enrich(
          uploadFileScanner.scanAll(savedFiles),
          savedFiles
      );

      Path resultPath = scanResultJsonBuilder.writeScanResultJson(
          workspace,
          command.scanId(),
          command.projectName(),
          findings
      );
      // worker 추적 메타데이터(resultCount/tool/toolVersion/payloadHash)를 계산한다.
      String payloadHash = calculatePayloadHash(resultPath);
      int resultCount = findings.size();
      String rawResultPath = uploadScanRawResultUploader.upload(command.scanId(), resultPath);
      uploadScanStatusUpdater.markRawUploaded(command.scanId(), rawResultPath);

      uploadScanAnalysisTaskDispatcher.dispatch(
          command.scanId(),
          command.projectId(),
          rawResultPath,
          resultCount,
          uploadScanToolMetadata.toolName(),
          uploadScanToolMetadata.toolVersion(),
          payloadHash
      );
      uploadScanStatusUpdater.markQueued(command.scanId());

      log.info(
          "Upload scan processing completed and queued: scanId={}, projectId={}, rawResultPath={}",
          command.scanId(),
          command.projectId(),
          rawResultPath
      );
      return UploadScanProcessingResult.queued();
    } catch (Exception ex) {
      return handleFailure(command, ex);
    } finally {
      tempWorkspaceManager.cleanup(workspace);
    }
  }

  private UploadScanProcessingResult handleFailure(UploadScanProcessingCommand command, Exception ex) {
    // 실패 원인별 DB 상태와 응답 코드를 고정해 기존 업로드 API 계약을 유지한다.
    if (ex instanceof UploadScanS3UploadException) {
      uploadScanStatusUpdater.markUploadFailed(command.scanId(), ScanFailureReason.RAW_RESULT_UPLOAD_FAILED);
      log.error("Upload scan S3 upload failed: scanId={}, projectId={}", command.scanId(), command.projectId(), ex);
      return UploadScanProcessingResult.failed(
          ScanFailureReason.RAW_RESULT_UPLOAD_FAILED,
          ErrorCode.RAW_RESULT_UPLOAD_FAILED
      );
    }

    if (ex instanceof UploadScanQueuePublishException) {
      uploadScanStatusUpdater.markQueuePublishFailed(
          command.scanId(),
          ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED
      );
      log.error("Upload scan queue publish failed: scanId={}, projectId={}", command.scanId(), command.projectId(), ex);
      return UploadScanProcessingResult.rawUploadedFailed(
          ScanFailureReason.ANALYSIS_QUEUE_PUBLISH_FAILED,
          ErrorCode.ANALYSIS_QUEUE_PUBLISH_FAILED
      );
    }

    uploadScanStatusUpdater.markExecutionFailed(command.scanId(), ScanFailureReason.SCAN_EXECUTION_FAILED);
    log.error("Upload scan execution failed: scanId={}, projectId={}", command.scanId(), command.projectId(), ex);
    return UploadScanProcessingResult.failed(
        ScanFailureReason.SCAN_EXECUTION_FAILED,
        ErrorCode.SCAN_EXECUTION_FAILED
    );
  }

  private String calculatePayloadHash(Path resultPath) {
    try {
      // 생성된 scan_result.json bytes 기준으로 sha256 해시를 계산한다.
      byte[] content = Files.readAllBytes(resultPath);
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashed = digest.digest(content);
      return "sha256:" + toHex(hashed);
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is not available", ex);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to calculate scan_result.json payload hash", ex);
    }
  }

  private String toHex(byte[] bytes) {
    StringBuilder builder = new StringBuilder(bytes.length * 2);
    for (byte value : bytes) {
      builder.append(String.format("%02x", value));
    }
    return builder.toString();
  }
}
