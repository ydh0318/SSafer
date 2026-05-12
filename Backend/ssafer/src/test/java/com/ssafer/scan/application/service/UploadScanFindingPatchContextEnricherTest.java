package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class UploadScanFindingPatchContextEnricherTest {

  private final UploadScanFindingPatchContextEnricher enricher = new UploadScanFindingPatchContextEnricher();

  @TempDir
  Path tempDir;

  @Test
  void enrichAddsPatchContextFromUploadedFileLine() throws Exception {
    Path dockerfile = tempDir.resolve("Dockerfile");
    Files.writeString(dockerfile, "FROM alpine\nUSER root\n", StandardCharsets.UTF_8);
    UploadScanFinding finding = new UploadScanFinding(
        "FND-0001",
        "DOCKERFILE_ROOT_USER",
        "custom-rule",
        "MEDIUM",
        "Dockerfile",
        2,
        "root user",
        "USER root"
    );

    List<UploadScanFinding> enriched = enricher.enrich(List.of(finding), List.of(dockerfile));

    UploadScanFinding enrichedFinding = enriched.getFirst();
    assertThat(enrichedFinding.filePath()).isEqualTo("Dockerfile");
    assertThat(enrichedFinding.patchContext()).isNotNull();
    assertThat(enrichedFinding.patchContext().oldText()).isEqualTo("USER root");
    assertThat(enrichedFinding.patchContext().lineStart()).isEqualTo(2);
    assertThat(enrichedFinding.patchContext().lineEnd()).isEqualTo(2);
    assertThat(enrichedFinding.patchContext().expectedFileHash()).isEqualTo(fileHash(dockerfile));
  }

  @Test
  void enrichSkipsPatchContextWhenFileMatchIsAmbiguous() throws Exception {
    Path first = tempDir.resolve("a").resolve("Dockerfile");
    Path second = tempDir.resolve("b").resolve("Dockerfile");
    Files.createDirectories(first.getParent());
    Files.createDirectories(second.getParent());
    Files.writeString(first, "USER root", StandardCharsets.UTF_8);
    Files.writeString(second, "USER root", StandardCharsets.UTF_8);
    UploadScanFinding finding = new UploadScanFinding(
        "FND-0001",
        "DOCKERFILE_ROOT_USER",
        "custom-rule",
        "MEDIUM",
        "Dockerfile",
        1,
        "root user",
        "USER root"
    );

    List<UploadScanFinding> enriched = enricher.enrich(List.of(finding), List.of(first, second));

    assertThat(enriched.getFirst().patchContext()).isNull();
  }

  @Test
  void enrichPreservesExistingPatchContext() throws Exception {
    Path dockerfile = tempDir.resolve("Dockerfile");
    Files.writeString(dockerfile, "USER root", StandardCharsets.UTF_8);
    UploadScanFindingPatchContext patchContext = new UploadScanFindingPatchContext(
        "existing",
        1,
        1,
        "sha256:existing"
    );
    UploadScanFinding finding = new UploadScanFinding(
        "FND-0001",
        "DOCKERFILE_ROOT_USER",
        "custom-rule",
        "MEDIUM",
        "Dockerfile",
        1,
        "root user",
        "USER root",
        "Dockerfile",
        patchContext
    );

    List<UploadScanFinding> enriched = enricher.enrich(List.of(finding), List.of(dockerfile));

    assertThat(enriched.getFirst().patchContext()).isSameAs(patchContext);
  }

  private String fileHash(Path file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest(Files.readAllBytes(file));
    StringBuilder builder = new StringBuilder(hash.length * 2);
    for (byte value : hash) {
      builder.append(String.format("%02x", value));
    }
    return "sha256:" + builder;
  }
}
