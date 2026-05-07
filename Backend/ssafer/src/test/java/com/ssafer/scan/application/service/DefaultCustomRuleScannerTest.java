package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DefaultCustomRuleScannerTest {

  private final DefaultCustomRuleScanner scanner = new DefaultCustomRuleScanner();

  @TempDir
  Path tempDir;

  @Test
  void scanDetectsPlainSecretInEnvFile() throws Exception {
    Path env = tempDir.resolve(".env");
    Files.writeString(env, "DB_PASSWORD=plain-secret\nNORMAL=value\n");

    List<UploadScanFinding> findings = scanner.scan(List.of(env));

    assertThat(findings).hasSize(1);
    UploadScanFinding finding = findings.getFirst();
    assertThat(finding.ruleId()).isEqualTo("ENV_PLAIN_SECRET");
    assertThat(finding.source()).isEqualTo("custom-rule");
    assertThat(finding.file()).isEqualTo(".env");
    assertThat(finding.line()).isEqualTo(1);
    assertThat(finding.maskedEvidence()).isEqualTo("DB_PASSWORD=***MASKED***");
  }

  @Test
  void scanDetectsRootUserInDockerfile() throws Exception {
    Path dockerfile = tempDir.resolve("Dockerfile");
    Files.writeString(dockerfile, "FROM alpine:3.20\nUSER root\n");

    List<UploadScanFinding> findings = scanner.scan(List.of(dockerfile));

    assertThat(findings).hasSize(1);
    UploadScanFinding finding = findings.getFirst();
    assertThat(finding.ruleId()).isEqualTo("DOCKERFILE_ROOT_USER");
    assertThat(finding.line()).isEqualTo(2);
  }

  @Test
  void scanDetectsPrivilegedModeInCompose() throws Exception {
    Path compose = tempDir.resolve("docker-compose.yml");
    Files.writeString(compose, "services:\n  app:\n    privileged: true\n");

    List<UploadScanFinding> findings = scanner.scan(List.of(compose));

    assertThat(findings).hasSize(1);
    UploadScanFinding finding = findings.getFirst();
    assertThat(finding.ruleId()).isEqualTo("COMPOSE_PRIVILEGED_MODE");
    assertThat(finding.line()).isEqualTo(3);
  }
}
