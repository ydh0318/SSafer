package com.ssafer.scan.application.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
@RequiredArgsConstructor
public class LocalProcessTrivyScanExecutor implements TrivyScanExecutor {

  private final ObjectMapper objectMapper;

  @Value("${APP_SCAN_UPLOAD_TRIVY_COMMAND:trivy}")
  private String trivyCommand;

  @Value("${APP_SCAN_UPLOAD_SCAN_TIMEOUT_SECONDS:30}")
  private long timeoutSeconds;

  @Override
  public List<UploadScanFinding> scan(List<Path> targetFiles) {
    // 업로드된 대상 파일별로 trivy config를 실행하고 공통 finding 모델로 정규화한다.
    List<UploadScanFinding> findings = new ArrayList<>();
    int findingIndex = 1;

    for (Path file : targetFiles) {
      String fileName = file.getFileName().toString();
      // env 파일은 커스텀 스캐너에서 처리하므로 Trivy 대상에서 제외한다.
      if (isEnvFile(fileName)) {
        continue;
      }

      JsonNode root = runTrivyConfig(file);
      JsonNode results = root.path("Results");
      if (!results.isArray()) {
        continue;
      }

      for (JsonNode result : results) {
        String resultFile = readText(result, "Target", fileName);

        for (JsonNode misconfiguration : result.path("Misconfigurations")) {
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              readText(misconfiguration, "ID", "UNKNOWN"),
              "trivy",
              normalizeSeverity(readText(misconfiguration, "Severity", "UNKNOWN")),
              resultFile,
              readStartLine(misconfiguration.path("CauseMetadata")),
              readText(misconfiguration, "Title", "Trivy misconfiguration"),
              truncateEvidence(readText(misconfiguration, "Message", ""))
          ));
        }

        for (JsonNode vulnerability : result.path("Vulnerabilities")) {
          String vulnId = readText(vulnerability, "VulnerabilityID", "UNKNOWN");
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              vulnId,
              "trivy",
              normalizeSeverity(readText(vulnerability, "Severity", "UNKNOWN")),
              resultFile,
              null,
              readText(vulnerability, "Title", vulnId),
              truncateEvidence(readText(vulnerability, "Description", ""))
          ));
        }

        for (JsonNode secret : result.path("Secrets")) {
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              readText(secret, "RuleID", "UNKNOWN"),
              "trivy",
              normalizeSeverity(readText(secret, "Severity", "UNKNOWN")),
              resultFile,
              readInteger(secret, "StartLine"),
              readText(secret, "Title", "Trivy secret finding"),
              truncateEvidence(readText(secret, "Match", ""))
          ));
        }
      }
    }

    return findings;
  }

  private JsonNode runTrivyConfig(Path targetFile) {
    // 외부 프로세스로 Trivy를 실행하고 JSON 결과를 파싱한다.
    List<String> command = List.of(
        trivyCommand,
        "config",
        "--quiet",
        "--format",
        "json",
        targetFile.toAbsolutePath().toString()
    );
    ProcessBuilder processBuilder = new ProcessBuilder(command).redirectErrorStream(true);

    try {
      Process process = processBuilder.start();
      boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
      if (!finished) {
        // timeout 초과 시 프로세스를 강제 종료한다.
        process.destroyForcibly();
        throw new IllegalStateException(
            "Trivy execution timed out after " + Duration.ofSeconds(timeoutSeconds)
        );
      }

      String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
      if (process.exitValue() != 0) {
        throw new IllegalStateException("Trivy execution failed: " + abbreviate(output));
      }
      if (output.isBlank()) {
        return objectMapper.createObjectNode();
      }
      return objectMapper.readTree(output);
    } catch (IllegalStateException ex) {
      throw ex;
    } catch (IOException ex) {
      throw new IllegalStateException("Failed to execute Trivy command: " + trivyCommand, ex);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Trivy execution was interrupted", ex);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to parse Trivy output", ex);
    }
  }

  private String normalizeSeverity(String severity) {
    if (severity == null || severity.isBlank()) {
      return "UNKNOWN";
    }
    return severity.toUpperCase(Locale.ROOT);
  }

  private String truncateEvidence(String evidence) {
    if (evidence == null) {
      return "";
    }
    String trimmed = evidence.trim();
    if (trimmed.length() <= 120) {
      return trimmed;
    }
    return trimmed.substring(0, 120);
  }

  private String formatFindingId(int index) {
    return String.format("FND-%04d", index);
  }

  private boolean isEnvFile(String fileName) {
    return fileName.equals(".env") || fileName.startsWith(".env.");
  }

  private String readText(JsonNode node, String fieldName, String defaultValue) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return defaultValue;
    }
    String text = value.asText();
    return text == null || text.isBlank() ? defaultValue : text;
  }

  private Integer readInteger(JsonNode node, String fieldName) {
    JsonNode value = node.get(fieldName);
    if (value == null || value.isNull()) {
      return null;
    }
    return value.asInt();
  }

  private Integer readStartLine(JsonNode causeMetadata) {
    if (causeMetadata == null || !causeMetadata.isObject()) {
      return null;
    }
    return readInteger(causeMetadata, "StartLine");
  }

  private String abbreviate(String text) {
    if (text == null) {
      return "";
    }
    String normalized = text.replaceAll("\\s+", " ").trim();
    if (normalized.length() <= 300) {
      return normalized;
    }
    return normalized.substring(0, 300);
  }
}
