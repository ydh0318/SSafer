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
    // 입력 finding의 원본 ID와 무관하게 최종 JSON에서는 순번 ID(FND-0001...)로 재부여되어야 한다.
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

    Path outputPath = builder.writeScanResultJson(tempDir, 1001L, "project-a", findings);

    // Worker가 기대하는 최소 계약 필드가 채워지는지 확인한다.
    assertThat(outputPath.getFileName().toString()).isEqualTo("scan_result.json");
    JsonNode root = objectMapper.readTree(outputPath.toFile());
    assertThat(root.path("schemaVersion").asText()).isEqualTo("0.1");
    assertThat(root.path("projectName").asText()).isEqualTo("project-a");
    assertThat(root.path("source").asText()).isEqualTo("cli");
    assertThat(root.path("analysisStatus").asText()).isEqualTo("SUCCESS");
    assertThat(root.path("findings").isArray()).isTrue();
    assertThat(root.path("findings").size()).isEqualTo(1);
    assertThat(root.path("findings").get(0).path("id").asText()).isEqualTo("FND-0001");
  }

  @Test
  void writeScanResultJsonIncludesPatchContextWhenPresent() throws Exception {
    UploadScanFindingPatchContext patchContext = new UploadScanFindingPatchContext(
        "USER root",
        3,
        3,
        "sha256:abc123"
    );
    List<UploadScanFinding> findings = List.of(
        new UploadScanFinding(
            "FND-9999",
            "DOCKERFILE_ROOT_USER",
            "custom-rule",
            "MEDIUM",
            "Dockerfile",
            3,
            "root user",
            "USER root",
            "Dockerfile",
            patchContext
        )
    );

    Path outputPath = builder.writeScanResultJson(tempDir, 1003L, "project-c", findings);

    JsonNode finding = objectMapper.readTree(outputPath.toFile()).path("findings").get(0);
    assertThat(finding.path("filePath").asText()).isEqualTo("Dockerfile");
    assertThat(finding.path("patchContext").path("oldText").asText()).isEqualTo("USER root");
    assertThat(finding.path("patchContext").path("lineStart").asInt()).isEqualTo(3);
    assertThat(finding.path("patchContext").path("lineEnd").asInt()).isEqualTo(3);
    assertThat(finding.path("patchContext").path("expectedFileHash").asText()).isEqualTo("sha256:abc123");
  }

  @Test
  void writeScanResultJsonIncludesEmptyFindingsArray() throws Exception {
    // finding이 없어도 findings 키는 빈 배열로 유지되어야 한다.
    Path outputPath = builder.writeScanResultJson(tempDir, 1002L, "project-b", List.of());

    JsonNode root = objectMapper.readTree(outputPath.toFile());
    assertThat(root.path("findings").isArray()).isTrue();
    assertThat(root.path("findings").size()).isZero();
  }
}
