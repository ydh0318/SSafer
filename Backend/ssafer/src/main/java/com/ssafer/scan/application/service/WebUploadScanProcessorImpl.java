package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
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
  private final UploadScanStatusUpdater uploadScanStatusUpdater;

  @Override
  public void process(UploadScanProcessingCommand command) {
    // 업로드 파일 기반 1차 점검 실행 흐름:
    // temp 저장 -> custom rule + trivy -> scan_result.json 생성 -> cleanup
    Path workspace = null;
    try {
      workspace = tempWorkspaceManager.createWorkspace(command.scanId());
      List<Path> savedFiles = tempWorkspaceManager.saveFiles(workspace, command.files());

      List<UploadScanFinding> findings = new ArrayList<>();
      findings.addAll(customRuleScanner.scan(savedFiles));
      findings.addAll(trivyScanExecutor.scan(savedFiles));

      // 태스크2 범위: 로컬에서 scan_result.json 생성까지 수행한다.
      Path resultPath = scanResultJsonBuilder.writeScanResultJson(workspace, command.scanId(), findings);
      log.info(
          "Upload scan execution completed in local workspace: scanId={}, projectId={}, resultPath={}",
          command.scanId(),
          command.projectId(),
          resultPath
      );
    } catch (Exception ex) {
      // 실행 실패 시 scan 상태를 FAILED로 반영하고 공통 에러코드로 변환한다.
      uploadScanStatusUpdater.markExecutionFailed(command.scanId(), ScanFailureReason.SCAN_EXECUTION_FAILED);
      log.error(
          "Upload scan execution failed: scanId={}, projectId={}",
          command.scanId(),
          command.projectId(),
          ex
      );
      throw new BusinessException(ErrorCode.SCAN_EXECUTION_FAILED);
    } finally {
      // 임시 파일은 항상 정리한다.
      tempWorkspaceManager.cleanup(workspace);
    }
  }
}
