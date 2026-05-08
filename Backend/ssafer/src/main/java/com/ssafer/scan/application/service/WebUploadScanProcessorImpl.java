package com.ssafer.scan.application.service;

import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.enums.ScanFailureReason;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebUploadScanProcessorImpl implements WebUploadScanProcessor {

  private final UploadScanTempWorkspaceManager tempWorkspaceManager;
  private final CustomRuleScanner customRuleScanner;
  private final TrivyScanExecutor trivyScanExecutor;
  private final ScanResultJsonBuilder scanResultJsonBuilder;
  private final UploadScanRawResultUploader uploadScanRawResultUploader;
  private final UploadScanAnalysisTaskDispatcher uploadScanAnalysisTaskDispatcher;
  private final UploadScanStatusUpdater uploadScanStatusUpdater;

  @Override
  public UploadScanProcessingResult process(UploadScanProcessingCommand command) {
    // 업로드 스캔 처리 순서:
    // temp 저장 -> 1차 점검 -> scan_result.json 생성 -> S3 저장 -> MQ 발행 -> 상태 전이
    Path workspace = null;
    try {
      workspace = tempWorkspaceManager.createWorkspace(command.scanId());
      List<Path> savedFiles = tempWorkspaceManager.saveFiles(workspace, command.files());

      List<UploadScanFinding> findings = new ArrayList<>();
      findings.addAll(customRuleScanner.scan(savedFiles));
      findings.addAll(trivyScanExecutor.scan(savedFiles));

      Path resultPath = scanResultJsonBuilder.writeScanResultJson(workspace, command.scanId(), findings);
      String rawResultPath = uploadScanRawResultUploader.upload(command.scanId(), resultPath);
      uploadScanStatusUpdater.markRawUploaded(command.scanId(), rawResultPath);

      uploadScanAnalysisTaskDispatcher.dispatch(command.scanId(), command.projectId(), rawResultPath);
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
    // 실패 원인별 DB 상태/응답 코드를 고정해 API 정책과 맞춘다.
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
}
