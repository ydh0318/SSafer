package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

class LocalProcessTrivyScanExecutorPolicyTest {

  @Test
  void scanSkipsComposeAndEnvWhenSelectingTrivyTargets() {
    LocalProcessTrivyScanExecutor executor = new LocalProcessTrivyScanExecutor(new ObjectMapper());
    ReflectionTestUtils.setField(executor, "trivyCommand", "this-command-does-not-exist");
    ReflectionTestUtils.setField(executor, "timeoutSeconds", 1L);

    List<UploadScanFinding> findings = executor.scan(List.of(
        Path.of("compose.vuln.yml"),
        Path.of(".env")
    ));

    assertThat(findings).isEmpty();
  }

  @Test
  void scanRunsTrivyForDockerfileTargets() {
    LocalProcessTrivyScanExecutor executor = new LocalProcessTrivyScanExecutor(new ObjectMapper());
    ReflectionTestUtils.setField(executor, "trivyCommand", "this-command-does-not-exist");
    ReflectionTestUtils.setField(executor, "timeoutSeconds", 1L);

    assertThatThrownBy(() -> executor.scan(List.of(Path.of("Dockerfile"))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Failed to execute Trivy command");
  }
}
