package com.ssafer.scan.application.service;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.entity.ScanNode;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
@Slf4j
@RequiredArgsConstructor
// S3 분석 결과 파일을 읽어 scan_nodes, scan_findings에 적재하고 최종 상태를 반영한다.
public class WorkerAnalysisResultPersistenceService {

  static final String INGESTING_PROGRESS_STEP = "INGESTING_ANALYSIS_RESULT";
  static final String COMPLETED_PROGRESS_STEP = "ANALYSIS_RESULT_SAVED";
  static final String FAILED_PROGRESS_STEP = "ANALYSIS_RESULT_SAVE_FAILED";
  private static final String DEFAULT_NODE_KEY = "analysis-result";
  private static final String DEFAULT_NODE_TYPE = "ANALYSIS_RESULT";

  private final ScanRepository scanRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final ScanNodeRepository scanNodeRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final AnalysisResultObjectReader analysisResultObjectReader;
  private final ObjectMapper objectMapper;

  @Transactional
  public void persist(WorkerAnalysisResultIngestionRequestedEvent event) {
    Scan scan = scanRepository.findByIdForUpdate(event.scanId())
        .orElseThrow(() -> new IllegalStateException("Scan not found: " + event.scanId()));
    AgentTask agentTask = agentTaskRepository.findByIdAndScanId(event.taskId(), event.scanId())
        .orElseThrow(() -> new IllegalStateException("Agent task not found: " + event.taskId()));

    if (scan.getStatus() == ScanStatus.DONE && agentTask.getTaskStatus() == AgentTaskStatus.SUCCEEDED) {
      log.info("Skip duplicate ingestion because scan is already completed: scanId={}, taskId={}", event.scanId(), event.taskId());
      return;
    }

    if (agentTask.getTaskStatus() == AgentTaskStatus.ACKED) {
      agentTask.markRunning(Instant.now());
    }

    String analysisResultPath = requireAnalysisResultPath(scan);
    JsonNode root = readAnalysisResultRoot(analysisResultPath);
    LocalDateTime now = LocalDateTime.now();
    LocalDateTime startedAt = event.startedAt() != null ? event.startedAt() : resolveStartedAt(scan, now);
    LocalDateTime completedAt = event.completedAt() != null ? event.completedAt() : resolveCompletedAt(root, now);

    ScanNode node = resolveNode(scan, root, startedAt);
    persistFindings(scan, node, root, now);

    agentTask.markSucceeded(toInstant(completedAt));
    scan.markAnalysisCompleted(COMPLETED_PROGRESS_STEP, startedAt, completedAt, completedAt);

    log.info(
        "Worker analysis result persisted: scanId={}, taskId={}, nodeId={}, findingCount={}",
        scan.getId(),
        agentTask.getId(),
        node.getId(),
        scanFindingRepository.countByScanId(scan.getId())
    );
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void markFailed(WorkerAnalysisResultIngestionRequestedEvent event, Exception ex) {
    Scan scan = scanRepository.findByIdForUpdate(event.scanId())
        .orElse(null);
    AgentTask agentTask = agentTaskRepository.findByIdAndScanId(event.taskId(), event.scanId())
        .orElse(null);

    if (scan == null || agentTask == null) {
      return;
    }

    LocalDateTime now = LocalDateTime.now();
    LocalDateTime startedAt = event.startedAt() != null ? event.startedAt() : resolveStartedAt(scan, now);
    String failureReason = abbreviateFailureReason(ex);

    if (!agentTask.getTaskStatus().isTerminal()) {
      if (agentTask.getTaskStatus() == AgentTaskStatus.ACKED) {
        agentTask.markRunning(toInstant(now));
      }
      agentTask.markRetryPending(failureReason);
    }

    if (!scan.getStatus().isTerminal()) {
      scan.markAnalysisRetryPending(FAILED_PROGRESS_STEP, failureReason, startedAt, now);
    }
  }

  private JsonNode readAnalysisResultRoot(String analysisResultPath) {
    try {
      return objectMapper.readTree(analysisResultObjectReader.read(analysisResultPath));
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to load analysis result object", ex);
    }
  }

  private String requireAnalysisResultPath(Scan scan) {
    if (scan.getAnalysisResultPath() == null || scan.getAnalysisResultPath().isBlank()) {
      throw new IllegalStateException("analysisResultPath is missing");
    }
    return scan.getAnalysisResultPath();
  }

  private ScanNode resolveNode(Scan scan, JsonNode root, LocalDateTime createdAt) {
    String nodeKey = readText(root, "scanId", DEFAULT_NODE_KEY);
    return scanNodeRepository.findByScanIdAndNodeKey(scan.getId(), nodeKey)
        .orElseGet(() -> scanNodeRepository.save(ScanNode.builder()
            .scanId(scan.getId())
            .nodeKey(nodeKey)
            .nodeName(readText(root, "source", "worker-analysis"))
            .nodeType(DEFAULT_NODE_TYPE)
            .metadataJson(buildNodeMetadataJson(root))
            .createdAt(createdAt)
            .build()));
  }

  private void persistFindings(Scan scan, ScanNode node, JsonNode root, LocalDateTime createdAt) {
    JsonNode results = root.path("results");
    if (!results.isArray()) {
      throw new IllegalStateException("analysis result must contain results array");
    }

    Set<String> existingFingerprints = new HashSet<>();
    Map<String, ScanFinding> existingFindingsByFingerprint = new HashMap<>();
    for (ScanFinding finding : scanFindingRepository.findAllByScanId(scan.getId())) {
      existingFingerprints.add(finding.getFingerprint());
      existingFindingsByFingerprint.put(finding.getFingerprint(), finding);
    }

    List<ScanFinding> findingsToSave = new ArrayList<>();
    for (JsonNode result : results) {
      String fingerprint = resolveFingerprint(result);
      String patchPayloadJson = buildPatchPayloadJson(result.path("fix"));
      if (existingFingerprints.contains(fingerprint)) {
        ScanFinding existingFinding = existingFindingsByFingerprint.get(fingerprint);
        if (existingFinding != null) {
          existingFinding.backfillPatchPayload(patchPayloadJson);
        }
        continue;
      }

      FindingSourceType sourceType = mapSourceType(readRequiredText(result, "source"));
      findingsToSave.add(ScanFinding.builder()
          .scanId(scan.getId())
          .scanNodeId(node.getId())
          .sourceType(sourceType)
          .fingerprint(fingerprint)
          .severity(mapSeverity(readRequiredText(result, "severity")))
          .category(sourceType.name())
          .title(readRequiredText(result, "title"))
          .description(readNullableText(result, "explanation"))
          .filePath(readNullableText(result, "file"))
          .lineNumber(readNullableInteger(result, "line"))
          .resourceName(readText(root, "source", "worker-analysis"))
          .ruleCode(readNullableText(result, "ruleId"))
          .attackScenario(readNullableText(result, "explanation"))
          .remediationGuide(buildRemediationGuide(result.path("fix")))
          .rawSnippetJson(buildRawSnippetJson(result))
          .patchPayloadJson(patchPayloadJson)
          .resolutionStatus(ResolutionStatus.OPEN)
          .createdAt(createdAt)
          .build());
      existingFingerprints.add(fingerprint);
    }

    if (!findingsToSave.isEmpty()) {
      scanFindingRepository.saveAll(findingsToSave);
    }
  }

  private String buildNodeMetadataJson(JsonNode root) {
    try {
      ObjectNode metadata = objectMapper.createObjectNode();
      copyIfPresent(root, metadata, "schemaVersion");
      copyIfPresent(root, metadata, "scanId");
      copyIfPresent(root, metadata, "source");
      copyIfPresent(root, metadata, "scannedAt");
      copyIfPresent(root, metadata, "generatedAt");
      copyIfPresent(root, metadata, "resultCount");
      return objectMapper.writeValueAsString(metadata);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to serialize node metadata", ex);
    }
  }

  private String buildRawSnippetJson(JsonNode result) {
    try {
      ObjectNode snippet = objectMapper.createObjectNode();
      copyIfPresent(result, snippet, "maskedEvidence");
      if (result.has("fix")) {
        snippet.set("fix", result.get("fix"));
      }
      return objectMapper.writeValueAsString(snippet);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to serialize raw snippet json", ex);
    }
  }

  // 승인 단계에서 worker 원본 patch payload를 그대로 재사용할 수 있게 별도 저장한다.
  private String buildPatchPayloadJson(JsonNode fix) {
    if (fix == null || fix.isMissingNode() || fix.isNull()) {
      return null;
    }

    JsonNode patches = fix.path("patches");
    if (!patches.isArray() || patches.isEmpty()) {
      return null;
    }

    try {
      ObjectNode payload = objectMapper.createObjectNode();
      payload.set("patches", patches);
      return objectMapper.writeValueAsString(payload);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to serialize patch payload json", ex);
    }
  }

  private String buildRemediationGuide(JsonNode fix) {
    if (fix == null || fix.isMissingNode() || fix.isNull()) {
      return null;
    }

    StringBuilder builder = new StringBuilder();
    appendLine(builder, readNullableText(fix, "summary"));
    appendArray(builder, "recommendedActions", fix.path("recommendedActions"));
    appendLine(builder, readNullableText(fix, "codeGuidance"));
    appendLine(builder, readNullableText(fix, "verification"));
    appendArray(builder, "cautions", fix.path("cautions"));
    return builder.length() == 0 ? null : builder.toString().trim();
  }

  private void appendLine(StringBuilder builder, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    if (!builder.isEmpty()) {
      builder.append('\n');
    }
    builder.append(value.trim());
  }

  private void appendArray(StringBuilder builder, String label, JsonNode values) {
    if (values == null || !values.isArray() || values.isEmpty()) {
      return;
    }
    if (!builder.isEmpty()) {
      builder.append('\n');
    }
    builder.append(label).append(':');
    for (JsonNode value : values) {
      builder.append('\n').append("- ").append(value.asText());
    }
  }

  private String resolveFingerprint(JsonNode result) {
    String findingId = readNullableText(result, "findingId");
    if (findingId != null) {
      return findingId;
    }
    return readText(result, "ruleId", "UNKNOWN")
        + "|" + readText(result, "file", "")
        + "|" + readText(result, "line", "")
        + "|" + readText(result, "title", "");
  }

  private FindingSourceType mapSourceType(String rawSource) {
    return switch (rawSource.toLowerCase(Locale.ROOT)) {
      case "trivy" -> FindingSourceType.TRIVY;
      case "custom-rule", "custom_rule" -> FindingSourceType.CUSTOM_RULE;
      case "ai" -> FindingSourceType.AI;
      default -> throw new IllegalStateException("Unsupported finding source: " + rawSource);
    };
  }

  private Severity mapSeverity(String rawSeverity) {
    try {
      return Severity.valueOf(rawSeverity.toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException ex) {
      throw new IllegalStateException("Unsupported severity: " + rawSeverity, ex);
    }
  }

  private LocalDateTime resolveStartedAt(Scan scan, LocalDateTime fallback) {
    return scan.getStartedAt() != null ? scan.getStartedAt() : fallback;
  }

  private LocalDateTime resolveCompletedAt(JsonNode root, LocalDateTime fallback) {
    String generatedAt = readNullableText(root, "generatedAt");
    if (generatedAt != null) {
      return OffsetDateTime.parse(generatedAt).toLocalDateTime();
    }
    return fallback;
  }

  private String readRequiredText(JsonNode node, String fieldName) {
    String value = readNullableText(node, fieldName);
    if (value == null || value.isBlank()) {
      throw new IllegalStateException("Missing required field: " + fieldName);
    }
    return value;
  }

  private String readText(JsonNode node, String fieldName, String defaultValue) {
    String value = readNullableText(node, fieldName);
    return value != null ? value : defaultValue;
  }

  private String readNullableText(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    return value.asText();
  }

  private Integer readNullableInteger(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    return value.asInt();
  }

  private void copyIfPresent(JsonNode source, ObjectNode target, String fieldName) {
    if (source.has(fieldName) && !source.get(fieldName).isNull()) {
      target.set(fieldName, source.get(fieldName));
    }
  }

  private Instant toInstant(LocalDateTime value) {
    return value.atZone(java.time.ZoneId.systemDefault()).toInstant();
  }

  private String abbreviateFailureReason(Exception ex) {
    String message = ex.getMessage();
    if (message == null || message.isBlank()) {
      return ex.getClass().getSimpleName();
    }
    return message.length() <= 500 ? message : message.substring(0, 500);
  }
}
