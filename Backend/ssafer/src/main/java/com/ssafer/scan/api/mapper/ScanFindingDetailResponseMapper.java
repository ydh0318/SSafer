package com.ssafer.scan.api.mapper;

import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.api.dto.ScanFindingExplanationResponse;
import com.ssafer.scan.api.dto.ScanFindingFixPatchResponse;
import com.ssafer.scan.api.dto.ScanFindingFixResponse;
import com.ssafer.scan.api.dto.ScanFindingReferenceResponse;
import com.ssafer.scan.domain.entity.ScanFinding;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public final class ScanFindingDetailResponseMapper {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private ScanFindingDetailResponseMapper() {
  }

  // 상세 조회는 기존 DB 컬럼과 worker 원본 JSON을 합쳐서, 프론트가 바로 쓸 수 있는 구조로 만든다.
  public static ScanFindingDetailResponse toResponse(ScanFinding finding) {
    JsonNode rawSnippet = readRawSnippet(finding.getRawSnippetJson());

    return new ScanFindingDetailResponse(
        finding.getId(),
        finding.getScanId(),
        finding.getScanNodeId(),
        finding.getSourceType(),
        finding.getFingerprint(),
        finding.getSeverity(),
        finding.getCategory(),
        finding.getTitle(),
        finding.getDescription(),
        readNullableText(rawSnippet, "maskedEvidence"),
        resolveExplanation(rawSnippet, finding),
        readNullableText(rawSnippet, "impact"),
        finding.getFilePath(),
        finding.getLineNumber(),
        finding.getResourceName(),
        finding.getRuleCode(),
        finding.getAttackScenario(),
        finding.getRemediationGuide(),
        resolveFix(rawSnippet),
        readReferenceArray(rawSnippet),
        readTextArray(rawSnippet, "targetFiles"),
        finding.getRawSnippetJson(),
        finding.getPatchPayloadJson(),
        finding.getResolutionStatus(),
        finding.getPatchApprovedActorType(),
        finding.getPatchApprovedByUserId(),
        finding.getPatchApprovedAt(),
        finding.getPatchResultMessage(),
        finding.getBackupFileName(),
        finding.getBackupFilePath(),
        finding.getBackupMetadataJson(),
        finding.getPatchedAt(),
        finding.getCreatedAt()
    );
  }

  private static JsonNode readRawSnippet(String rawSnippetJson) {
    if (rawSnippetJson == null || rawSnippetJson.isBlank()) {
      return OBJECT_MAPPER.createObjectNode();
    }

    try {
      return OBJECT_MAPPER.readTree(rawSnippetJson);
    } catch (Exception ignored) {
      // 과거 적재값이 비정상이어도 상세 조회 자체는 끊기지 않게 빈 객체로 되돌린다.
      return OBJECT_MAPPER.createObjectNode();
    }
  }

  private static ScanFindingExplanationResponse resolveExplanation(
      JsonNode rawSnippet,
      ScanFinding finding
  ) {
    JsonNode explanation = rawSnippet.path("explanation");
    if (explanation.isObject()) {
      return new ScanFindingExplanationResponse(
          readNullableText(explanation, "summary"),
          readNullableText(explanation, "whyRisky"),
          readNullableText(explanation, "abuseScenario"),
          readNullableText(explanation, "expectedImpact"),
          readNullableText(explanation, "severityInterpretation")
      );
    }

    // 구형 데이터는 explanation 객체가 없을 수 있으므로 기존 컬럼 기반 최소 설명을 유지한다.
    if (finding.getDescription() == null && finding.getAttackScenario() == null) {
      return null;
    }

    return new ScanFindingExplanationResponse(
        finding.getDescription(),
        null,
        finding.getAttackScenario(),
        null,
        null
    );
  }

  private static ScanFindingFixResponse resolveFix(JsonNode rawSnippet) {
    JsonNode fix = rawSnippet.path("fix");
    if (!fix.isObject()) {
      return null;
    }

    return new ScanFindingFixResponse(
        readNullableText(fix, "summary"),
        readNullableText(fix, "priority"),
        readTextArray(fix, "recommendedActions"),
        readNullableText(fix, "codeGuidance"),
        readNullableText(fix, "verification"),
        readTextArray(fix, "cautions"),
        readPatchArray(fix.path("patches"))
    );
  }

  private static List<ScanFindingFixPatchResponse> readPatchArray(JsonNode patches) {
    if (!patches.isArray() || patches.isEmpty()) {
      return List.of();
    }

    List<ScanFindingFixPatchResponse> mapped = new ArrayList<>();
    for (JsonNode patch : patches) {
      mapped.add(new ScanFindingFixPatchResponse(
          readNullableText(patch, "patchId"),
          readNullableText(patch, "findingId"),
          readNullableText(patch, "operation"),
          readNullableText(patch, "filePath"),
          readNullableText(patch, "oldText"),
          readNullableText(patch, "newText"),
          readNullableText(patch, "expectedFileHash")
      ));
    }
    return mapped;
  }

  private static List<ScanFindingReferenceResponse> readReferenceArray(JsonNode rawSnippet) {
    JsonNode references = rawSnippet.path("references");
    if (!references.isArray() || references.isEmpty()) {
      return List.of();
    }

    List<ScanFindingReferenceResponse> mapped = new ArrayList<>();
    for (JsonNode ref : references) {
      mapped.add(new ScanFindingReferenceResponse(
          readNullableText(ref, "title"),
          readNullableText(ref, "url"),
          readNullableText(ref, "snippet")
      ));
    }
    return mapped;
  }

  private static List<String> readTextArray(JsonNode node, String fieldName) {
    JsonNode values = node.path(fieldName);
    if (!values.isArray() || values.isEmpty()) {
      return List.of();
    }

    List<String> mapped = new ArrayList<>();
    for (JsonNode value : values) {
      String text = normalizeNullableText(value.asText(null));
      if (text != null) {
        mapped.add(text);
      }
    }
    return mapped;
  }

  private static String readNullableText(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    return normalizeNullableText(value.asText());
  }

  private static String normalizeNullableText(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
