package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class ScanResultJsonBuilderTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final ScanResultJsonBuilder builder = new ScanResultJsonBuilder(objectMapper);

  @TempDir
  Path tempDir;

  @Test
  void writeScanResultJsonCreatesSchemaCompatiblePayload() throws Exception {
    List<UploadScanFinding> findings = List.of(
        new UploadScanFinding(
            "FND-9999",
            "ENV_PLAIN_SECRET",
            "custom-rule",
            "HIGH",
            ".env",
            1,
            "secret found",
            "DB_PASSWORD=***MASKED***"
        )
    );

    Path outputPath = builder.writeScanResultJson(tempDir, 1001L, findings);

    assertThat(outputPath.getFileName().toString()).isEqualTo("scan_result.json");
    JsonNode root = objectMapper.readTree(outputPath.toFile());
    assertThat(root.path("schemaVersion").asText()).isEqualTo("0.1");
    assertThat(root.path("source").asText()).isEqualTo("cli");
    assertThat(root.path("analysisStatus").asText()).isEqualTo("SUCCESS");
    assertThat(root.path("findings").isArray()).isTrue();
    assertThat(root.path("findings").size()).isEqualTo(1);
    assertThat(root.path("findings").get(0).path("id").asText()).isEqualTo("FND-0001");
  }

  @Test
  void writeScanResultJsonIncludesEmptyFindingsArray() throws Exception {
    Path outputPath = builder.writeScanResultJson(tempDir, 1002L, List.of());

    JsonNode root = objectMapper.readTree(outputPath.toFile());
    assertThat(root.path("findings").isArray()).isTrue();
    assertThat(root.path("findings").size()).isZero();
  }
}
