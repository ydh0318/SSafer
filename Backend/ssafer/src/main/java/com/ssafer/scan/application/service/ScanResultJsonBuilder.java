package com.ssafer.scan.application.service;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ScanResultJsonBuilder {

  private final ObjectMapper objectMapper;

  public ScanResultJsonBuilder(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public Path writeScanResultJson(
      Path workspace,
      Long scanId,
      String projectName,
      List<UploadScanFinding> findings
  ) {
    // Worker가 읽는 scan_result.json 계약(schemaVersion 0.1)에 맞춰 payload를 만든다.
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("schemaVersion", "0.1");
    payload.put("scanId", UUID.randomUUID().toString());
    // 업로드 요청의 프로젝트 식별값을 결과에 함께 남긴다.
    payload.put("projectName", projectName);
    payload.put("source", "cli");
    payload.put("scannedAt", Instant.now().toString());
    payload.put("analysisStatus", "SUCCESS");
    payload.put("findings", toFindingMaps(findings));
    payload.put("uploadScanId", scanId);

    Path outputPath = workspace.resolve("scan_result.json");
    try {
      String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
      Files.writeString(outputPath, json, StandardCharsets.UTF_8);
      return outputPath;
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to write scan_result.json", ex);
    }
  }

  private List<Map<String, Object>> toFindingMaps(List<UploadScanFinding> findings) {
    // 결과 파일의 findingId는 순번(FND-0001...)으로 다시 부여한다.
    List<Map<String, Object>> mappedFindings = new java.util.ArrayList<>();
    int index = 1;
    for (UploadScanFinding finding : findings) {
      mappedFindings.add(toFindingMap(finding, index++));
    }
    return mappedFindings;
  }

  private Map<String, Object> toFindingMap(UploadScanFinding finding, int index) {
    Map<String, Object> mapped = new LinkedHashMap<>();
    mapped.put("id", String.format("FND-%04d", index));
    mapped.put("ruleId", finding.ruleId());
    mapped.put("source", finding.source());
    mapped.put("severity", finding.severity());
    mapped.put("file", finding.file());
    // filePath는 AI가 fix.patches.filePath를 만들 때 참조하는 업로드 파일 식별자다.
    if (finding.filePath() != null && !finding.filePath().isBlank()) {
      mapped.put("filePath", finding.filePath());
    }
    mapped.put("line", finding.line());
    mapped.put("title", finding.title());
    mapped.put("maskedEvidence", finding.maskedEvidence());
    if (finding.patchContext() != null) {
      mapped.put("patchContext", toPatchContextMap(finding.patchContext()));
    }
    return mapped;
  }

  private Map<String, Object> toPatchContextMap(UploadScanFindingPatchContext patchContext) {
    // patchContext는 scan_result.json에 그대로 실려 AI 분석 입력으로 전달된다.
    Map<String, Object> mapped = new LinkedHashMap<>();
    mapped.put("oldText", patchContext.oldText());
    mapped.put("lineStart", patchContext.lineStart());
    mapped.put("lineEnd", patchContext.lineEnd());
    mapped.put("expectedFileHash", patchContext.expectedFileHash());
    return mapped;
  }
}
