package com.ssafer.scan.api.mapper;

import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanRequestSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public final class ScanRequestSourceResolver {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private ScanRequestSourceResolver() {
  }

  public static ScanRequestSource resolve(Scan scan) {
    if (scan.getTargetSnapshotJson() == null || scan.getTargetSnapshotJson().isBlank()) {
      return null;
    }

    try {
      JsonNode root = OBJECT_MAPPER.readTree(scan.getTargetSnapshotJson());
      JsonNode sourceNode = root.get("source");
      if (sourceNode == null || sourceNode.isNull() || sourceNode.asText().isBlank()) {
        return null;
      }
      return ScanRequestSource.valueOf(sourceNode.asText());
    } catch (Exception ignored) {
      return null;
    }
  }
}
