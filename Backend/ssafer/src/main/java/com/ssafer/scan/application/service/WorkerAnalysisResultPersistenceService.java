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
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
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
  private final ApplicationEventPublisher applicationEventPublisher;

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
    // 완료 알림은 커밋 이후 발행해서 프론트가 즉시 재조회해도 DONE을 읽도록 맞춘다.
    applicationEventPublisher.publishEvent(new ScanStatusSsePublishRequestedEvent(scan.getId(), ScanStatus.DONE));

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
      agentTask.markFailed(toInstant(now), failureReason);
    }

    if (!scan.getStatus().isTerminal()) {
      // 적재 재시도 루프가 없는 현재 구조에서는 중간 상태로 남기지 않고 최종 실패로 닫는다.
      scan.markAnalysisFailed(FAILED_PROGRESS_STEP, failureReason, startedAt, now, now);
      applicationEventPublisher.publishEvent(new ScanStatusSsePublishRequestedEvent(scan.getId(), ScanStatus.FAILED));
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
    // 현재 worker 스키마(results)와 이전 업로드 스키마(findings)를 모두 흡수한다.
    JsonNode results = resolveFindings(root);
    // finding loop 전에 루트 patch 배열을 findingId 기준으로 묶어두면 각 finding 적재 시 재탐색을 피할 수 있다.
    Map<String, List<JsonNode>> rootPatchesByFindingId = indexRootPatches(root);

    Map<String, ScanFinding> existingFindingsByFingerprint = new HashMap<>();
    for (ScanFinding finding : scanFindingRepository.findAllByScanId(scan.getId())) {
      existingFindingsByFingerprint.put(finding.getFingerprint(), finding);
    }

    List<ScanFinding> findingsToSave = new ArrayList<>();
    for (JsonNode result : results) {
      // source/severity 같은 표준 필드는 entity 컬럼으로 승격하고,
      // 나머지 원본 필드는 rawSnippetJson에 최대한 보존한다.
      FindingSourceType sourceType = mapSourceType(readRequiredText(result, "source"));
      String fingerprint = resolveFingerprint(result, sourceType);
      ScanFinding existingFinding = findExistingFinding(existingFindingsByFingerprint, result, fingerprint);
      Severity severity = mapSeverity(readRequiredText(result, "severity"));
      String category = resolveCategory(result, sourceType);
      String description = resolveDescription(result);
      String filePath = resolveFindingFilePath(result);
      Integer lineNumber = readNullableInteger(result, "line");
      String resourceName = resolveResourceName(result, root);
      String ruleCode = readNullableText(result, "ruleId");
      String attackScenario = resolveAttackScenario(result);
      String remediationGuide = buildRemediationGuide(result.path("fix"));
      String rawSnippetJson = buildRawSnippetJson(result);
      String patchPayloadJson = supportsPatchGeneration(scan)
          ? buildPatchPayloadJson(rootPatchesByFindingId, result)
          : null;
      if (existingFinding != null) {
        String previousFingerprint = existingFinding.getFingerprint();
        // 예전 적재분이 있더라도 재적재 시 worker 본문은 최신 구조로 덮어써서 old/partial 데이터를 남기지 않는다.
        existingFinding.refreshAnalysisPayload(
            sourceType,
            fingerprint,
            severity,
            category,
            readRequiredText(result, "title"),
            description,
            filePath,
            lineNumber,
            resourceName,
            ruleCode,
            attackScenario,
            remediationGuide,
            rawSnippetJson,
            patchPayloadJson
        );
        existingFindingsByFingerprint.remove(previousFingerprint);
        existingFindingsByFingerprint.put(fingerprint, existingFinding);
        continue;
      }

      findingsToSave.add(ScanFinding.builder()
          .scanId(scan.getId())
          .scanNodeId(node.getId())
          .sourceType(sourceType)
          .fingerprint(fingerprint)
          .severity(severity)
          .category(category)
          .title(readRequiredText(result, "title"))
          .description(description)
          .filePath(filePath)
          .lineNumber(lineNumber)
          .resourceName(resourceName)
          .ruleCode(ruleCode)
          .attackScenario(attackScenario)
          .remediationGuide(remediationGuide)
          .rawSnippetJson(rawSnippetJson)
          .patchPayloadJson(patchPayloadJson)
          .resolutionStatus(ResolutionStatus.OPEN)
          .createdAt(createdAt)
          .build());
      existingFindingsByFingerprint.put(fingerprint, findingsToSave.get(findingsToSave.size() - 1));
    }

    if (!findingsToSave.isEmpty()) {
      scanFindingRepository.saveAll(findingsToSave);
    }
  }

  private JsonNode resolveFindings(JsonNode root) {
    JsonNode results = root.path("results");
    if (results.isArray()) {
      return results;
    }

    // 기존 업로드 결과 JSON은 findings 배열을 사용한다.
    JsonNode findings = root.path("findings");
    if (findings.isArray()) {
      return findings;
    }

    throw new IllegalStateException("analysis result must contain results or findings array");
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
      // 조회 API 상세에서 원본 worker 식별자와 표시용 필드를 다시 사용할 수 있게 보존한다.
      copyIfPresent(result, snippet, "findingId");
      copyIfPresent(result, snippet, "id");
      copyIfPresent(result, snippet, "filePath");
      copyIfPresent(result, snippet, "maskedEvidence");
      copyIfPresent(result, snippet, "impact");
      copyIfPresent(result, snippet, "targetFiles");
      if (result.has("explanation") && !result.get("explanation").isNull()) {
        snippet.set("explanation", result.get("explanation"));
      }
      if (result.has("fix")) {
        snippet.set("fix", result.get("fix"));
      }
      return objectMapper.writeValueAsString(snippet);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to serialize raw snippet json", ex);
    }
  }

  // 승인 단계에서 worker 원본 patch payload를 그대로 재사용할 수 있게 별도 저장한다.
  private Map<String, List<JsonNode>> indexRootPatches(JsonNode root) {
    Map<String, List<JsonNode>> indexed = new HashMap<>();
    JsonNode patches = root.path("patches");
    if (!patches.isArray()) {
      return indexed;
    }

    for (JsonNode patch : patches) {
      // 루트 patch는 findingId로 귀속되므로 적재 시 빠르게 찾을 수 있게 인메모리 index를 만든다.
      String findingId = readNullableText(patch, "findingId");
      if (findingId == null || findingId.isBlank()) {
        continue;
      }
      indexed.computeIfAbsent(findingId.trim(), ignored -> new ArrayList<>()).add(patch);
    }
    return indexed;
  }

  private String buildPatchPayloadJson(Map<String, List<JsonNode>> rootPatchesByFindingId, JsonNode result) {
    String externalFindingId = resolveExternalFindingId(result);
    if (externalFindingId != null) {
      // 새 worker 스키마는 루트 patches 배열이 정본이다.
      List<JsonNode> rootPatches = rootPatchesByFindingId.get(externalFindingId);
      if (rootPatches != null && !rootPatches.isEmpty()) {
        return serializePatchPayload(rootPatches);
      }
    }

    JsonNode fix = result.path("fix");
    if (fix == null || fix.isMissingNode() || fix.isNull()) {
      return null;
    }

    // 이전 스키마와의 호환을 위해 fix.patches도 계속 허용한다.
    JsonNode patches = fix.path("patches");
    if (!patches.isArray() || patches.isEmpty()) {
      return null;
    }

    List<JsonNode> nestedPatches = new ArrayList<>();
    for (JsonNode patch : patches) {
      nestedPatches.add(patch);
    }
    return serializePatchPayload(nestedPatches);
  }

  private String serializePatchPayload(List<JsonNode> patches) {
    try {
      ObjectNode payload = objectMapper.createObjectNode();
      ArrayNode patchArray = objectMapper.createArrayNode();
      for (JsonNode patch : patches) {
        patchArray.add(patch);
      }
      payload.set("patches", patchArray);
      return objectMapper.writeValueAsString(payload);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to serialize patch payload json", ex);
    }
  }

  private boolean supportsPatchGeneration(Scan scan) {
    return scan.getScanType() == ScanType.PROJECT_FILE;
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

  private String resolveDescription(JsonNode result) {
    JsonNode explanation = result.get("explanation");
    if (explanation == null || explanation.isNull()) {
      return null;
    }

    if (explanation.isTextual()) {
      return normalizeNullableText(explanation.asText());
    }

    if (explanation.isObject()) {
      String summary = readNullableText(explanation, "summary");
      if (summary != null && !summary.isBlank()) {
        return summary.trim();
      }
      return normalizeNullableText(readNullableText(explanation, "whyRisky"));
    }

    return null;
  }

  private String resolveAttackScenario(JsonNode result) {
    JsonNode explanation = result.get("explanation");
    if (explanation == null || explanation.isNull()) {
      return null;
    }

    if (explanation.isTextual()) {
      return normalizeNullableText(explanation.asText());
    }

    if (explanation.isObject()) {
      String abuseScenario = readNullableText(explanation, "abuseScenario");
      if (abuseScenario != null && !abuseScenario.isBlank()) {
        return abuseScenario.trim();
      }
      return normalizeNullableText(readNullableText(explanation, "expectedImpact"));
    }

    return null;
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

  private ScanFinding findExistingFinding(
      Map<String, ScanFinding> existingFindingsByFingerprint,
      JsonNode result,
      String preferredFingerprint
  ) {
    // 새 fingerprint 규칙으로 저장된 데이터가 있으면 그 값을 우선 사용한다.
    ScanFinding existingFinding = existingFindingsByFingerprint.get(preferredFingerprint);
    if (existingFinding != null) {
      return existingFinding;
    }

    // 과거에는 worker findingId(FND-0001 등)를 fingerprint로 저장했으므로 재적재 호환을 유지한다.
    String externalFindingId = resolveExternalFindingId(result);
    if (externalFindingId != null) {
      existingFinding = existingFindingsByFingerprint.get(externalFindingId);
      if (existingFinding != null) {
        return existingFinding;
      }
    }

    return null;
  }

  private String resolveFingerprint(JsonNode result, FindingSourceType sourceType) {
    String explicitFingerprint = readNullableText(result, "fingerprint");
    if (explicitFingerprint != null && !explicitFingerprint.isBlank()) {
      return explicitFingerprint.trim();
    }

    // worker findingId는 스캔별 순번일 수 있어 비교 키로 불안정하므로 내용 기반 fingerprint를 만든다.
    String material = sourceType.name()
        + "|" + readText(result, "ruleId", "UNKNOWN")
        + "|" + readText(result, "filePath", readText(result, "file", ""))
        + "|" + readText(result, "line", "")
        + "|" + readText(result, "title", "")
        + "|" + readText(result, "maskedEvidence", "");
    return "sha256:" + sha256Hex(material);
  }

  private String resolveExternalFindingId(JsonNode result) {
    String findingId = readNullableText(result, "findingId");
    if (findingId != null && !findingId.isBlank()) {
      return findingId.trim();
    }

    String legacyId = readNullableText(result, "id");
    if (legacyId != null && !legacyId.isBlank()) {
      return legacyId.trim();
    }

    return null;
  }

  private String resolveCategory(JsonNode result, FindingSourceType sourceType) {
    String category = readNullableText(result, "category");
    if (category != null && !category.isBlank()) {
      return category.trim();
    }
    return sourceType.name();
  }

  private String resolveResourceName(JsonNode result, JsonNode root) {
    String resourceName = readNullableText(result, "resourceName");
    if (resourceName != null && !resourceName.isBlank()) {
      return resourceName.trim();
    }

    String file = readNullableText(result, "file");
    if (file != null && !file.isBlank()) {
      return file.trim();
    }

    String filePath = readNullableText(result, "filePath");
    if (filePath != null && !filePath.isBlank()) {
      return filePath.trim();
    }

    return readText(root, "source", "worker-analysis");
  }

  private String resolveFindingFilePath(JsonNode result) {
    String filePath = readNullableText(result, "filePath");
    if (filePath != null && !filePath.isBlank()) {
      return filePath.trim();
    }

    String file = readNullableText(result, "file");
    if (file != null && !file.isBlank()) {
      return file.trim();
    }

    return null;
  }

  private String sha256Hex(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder(hashed.length * 2);
      for (byte current : hashed) {
        builder.append(String.format("%02x", current));
      }
      return builder.toString();
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to create finding fingerprint", ex);
    }
  }

  private FindingSourceType mapSourceType(String rawSource) {
    return switch (rawSource.toLowerCase(Locale.ROOT)) {
      case "trivy" -> FindingSourceType.TRIVY;
      case "custom-rule", "custom_rule" -> FindingSourceType.CUSTOM_RULE;
      case "ai" -> FindingSourceType.AI;
      case "server-audit", "server_audit" -> FindingSourceType.SERVER_AUDIT;
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
    return normalizeNullableText(value.asText());
  }

  private String normalizeNullableText(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
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
