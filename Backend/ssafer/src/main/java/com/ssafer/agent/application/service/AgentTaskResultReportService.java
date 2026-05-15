package com.ssafer.agent.application.service;

import com.ssafer.agent.api.dto.AgentTaskResultReportRequest;
import com.ssafer.agent.api.dto.AgentTaskResultReportRequest.PatchResultItem;
import com.ssafer.agent.api.dto.AgentTaskResultReportRequest.PatchResultStatus;
import com.ssafer.agent.api.dto.AgentTaskResultReportResponseData;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.domain.entity.ScanFinding;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class AgentTaskResultReportService {

  private final AgentTaskRepository agentTaskRepository;
  private final ObjectMapper objectMapper;

  @Transactional
  public AgentTaskResultReportResponseData reportResult(
      Long pathAgentId,
      Long authenticatedAgentId,
      Long taskId,
      AgentTaskResultReportRequest request
  ) {
    // path의 agentId와 토큰의 agentId가 다르면 다른 agent의 task 결과를 보고할 수 없다.
    if (!pathAgentId.equals(authenticatedAgentId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    // 결과 보고는 task/finding 상태를 동시에 바꾸므로 같은 task에 대한 중복 처리를 막기 위해 잠금 조회한다.
    AgentTask task = agentTaskRepository.findByIdAndAgentIdForUpdate(taskId, pathAgentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    validateReportableTask(task);
    validateRequest(task, request);

    if (task.getTaskType() == AgentTaskType.SCAN_REQUEST) {
      return reportScanRequestResult(task, request);
    }
    return reportPatchApplyResult(task, request);
  }

  private AgentTaskResultReportResponseData reportScanRequestResult(
      AgentTask task,
      AgentTaskResultReportRequest request
  ) {
    Instant now = Instant.now();
    String resultMessage = resolveTaskResultMessage(request.resultMessage(), request.taskStatus());

    advanceToRunning(task, now);
    if (request.taskStatus() == AgentTaskStatus.SUCCEEDED) {
      task.markSucceeded(now);
    } else {
      task.markFailed(now, resultMessage);
    }

    return new AgentTaskResultReportResponseData(
        task.getId(),
        task.getTaskStatus(),
        null,
        null
    );
  }

  private AgentTaskResultReportResponseData reportPatchApplyResult(
      AgentTask task,
      AgentTaskResultReportRequest request
  ) {

    // MVP에서는 PATCH_APPLY task 1개가 finding 1개와 연결되어 있어야 한다.
    ScanFinding finding = task.getFinding();
    if (finding == null) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }

    List<PatchResultItem> patchResults = normalizePatchResults(request.patchResults());
    String patchResultMessage = resolvePatchResultMessage(request.resultMessage(), patchResults, request.taskStatus());
    String backupMetadataJson = serializeBackupMetadata(patchResults);

    Instant now = Instant.now();
    // 별도 ACK/RUNNING API 없이 결과 보고 시점에 필요한 중간 상태를 내부에서 보정한다.
    advanceToRunning(task, now);
    if (request.taskStatus() == AgentTaskStatus.SUCCEEDED) {
      String backupFilePath = firstSuccessfulBackupPath(patchResults);
      finding.markPatchResolved(
          patchResultMessage,
          extractFileName(backupFilePath),
          backupFilePath,
          backupMetadataJson,
          LocalDateTime.ofInstant(now, ZoneId.systemDefault())
      );
      task.markSucceeded(now);
    } else {
      finding.markPatchFailed(patchResultMessage, backupMetadataJson);
      task.markFailed(now, patchResultMessage);
    }

    return new AgentTaskResultReportResponseData(
        task.getId(),
        task.getTaskStatus(),
        finding.getId(),
        finding.getResolutionStatus()
    );
  }

  private void validateReportableTask(AgentTask task) {
    if (task.getTaskType() != AgentTaskType.PATCH_APPLY
        && task.getTaskType() != AgentTaskType.SCAN_REQUEST) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    // 이미 종료된 task는 같은 결과가 다시 들어와도 중복 반영하지 않는다.
    if (task.getTaskStatus().isTerminal()) {
      throw new BusinessException(ErrorCode.TASK_STATUS_CONFLICT);
    }
    if (task.getTaskStatus() != AgentTaskStatus.SENT
        && task.getTaskStatus() != AgentTaskStatus.ACKED
        && task.getTaskStatus() != AgentTaskStatus.RUNNING) {
      throw new BusinessException(ErrorCode.TASK_STATUS_CONFLICT);
    }
  }

  private void validateRequest(AgentTask task, AgentTaskResultReportRequest request) {
    if (request.taskStatus() != AgentTaskStatus.SUCCEEDED && request.taskStatus() != AgentTaskStatus.FAILED) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    List<PatchResultItem> patchResults = normalizePatchResults(request.patchResults());
    if (task.getTaskType() == AgentTaskType.PATCH_APPLY
        && request.taskStatus() == AgentTaskStatus.SUCCEEDED) {
      // 성공 보고는 실제 적용된 patch 결과가 있어야 하며, 일부 실패는 MVP에서 전체 실패로 처리한다.
      if (patchResults.isEmpty()) {
        throw new BusinessException(ErrorCode.INVALID_PARAMETER);
      }
      boolean allSucceeded = patchResults.stream()
          .allMatch(result -> result.status() == PatchResultStatus.SUCCESS);
      if (!allSucceeded) {
        throw new BusinessException(ErrorCode.INVALID_PARAMETER);
      }
    }
  }

  private void advanceToRunning(AgentTask task, Instant now) {
    if (task.getTaskStatus() == AgentTaskStatus.SENT) {
      task.markAcked(now);
    }
    if (task.getTaskStatus() == AgentTaskStatus.ACKED) {
      task.markRunning(now);
    }
  }

  private List<PatchResultItem> normalizePatchResults(List<PatchResultItem> patchResults) {
    return patchResults == null ? List.of() : patchResults;
  }

  private String resolvePatchResultMessage(
      String resultMessage,
      List<PatchResultItem> patchResults,
      AgentTaskStatus taskStatus
  ) {
    if (resultMessage != null && !resultMessage.isBlank()) {
      return resultMessage.trim();
    }
    return patchResults.stream()
        .map(PatchResultItem::message)
        .filter(message -> message != null && !message.isBlank())
        .findFirst()
        .orElse(taskStatus == AgentTaskStatus.SUCCEEDED
            ? "Patch applied successfully."
            : "Patch apply failed.");
  }

  private String resolveTaskResultMessage(String resultMessage, AgentTaskStatus taskStatus) {
    if (resultMessage != null && !resultMessage.isBlank()) {
      return resultMessage.trim();
    }
    return taskStatus == AgentTaskStatus.SUCCEEDED
        ? "Task completed successfully."
        : "Task failed.";
  }

  private String serializeBackupMetadata(List<PatchResultItem> patchResults) {
    try {
      Map<String, Object> metadata = new LinkedHashMap<>();
      // 개별 patch 결과 전체를 보관해서 나중에 파일별 적용 결과를 확인할 수 있게 한다.
      metadata.put("patchResults", patchResults);
      return objectMapper.writeValueAsString(metadata);
    } catch (Exception ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private String firstSuccessfulBackupPath(List<PatchResultItem> patchResults) {
    // scan_findings에는 대표 백업 경로 1개만 저장하고, 전체 목록은 backup_metadata_json에 남긴다.
    return patchResults.stream()
        .filter(result -> result.status() == PatchResultStatus.SUCCESS)
        .map(PatchResultItem::backupPath)
        .filter(path -> path != null && !path.isBlank())
        .findFirst()
        .orElse(null);
  }

  private String extractFileName(String backupFilePath) {
    if (backupFilePath == null || backupFilePath.isBlank()) {
      return null;
    }
    String normalizedPath = backupFilePath.replace('\\', '/');
    int lastSeparatorIndex = normalizedPath.lastIndexOf('/');
    if (lastSeparatorIndex < 0) {
      return normalizedPath;
    }
    return normalizedPath.substring(lastSeparatorIndex + 1);
  }
}
