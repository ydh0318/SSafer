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

  public Path writeScanResultJson(Path workspace, Long scanId, List<UploadScanFinding> findings) {
    // AI/Worker가 읽는 scan_result.json 계약(schemaVersion 0.1)에 맞춰 payload를 생성한다.
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("schemaVersion", "0.1");
    payload.put("scanId", UUID.randomUUID().toString());
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
    // 최종 출력 시 findingId를 연속 번호(FND-0001...)로 재정렬한다.
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
    mapped.put("line", finding.line());
    mapped.put("title", finding.title());
    mapped.put("maskedEvidence", finding.maskedEvidence());
    return mapped;
  }
}
