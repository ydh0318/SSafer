package com.ssafer.scan.application.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
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

  @Value("${APP_SCAN_UPLOAD_SCAN_TIMEOUT_SECONDS:120}")
  private long timeoutSeconds;

  @Override
  public List<UploadScanFinding> scan(List<Path> targetFiles) {
    // 업로드 파일별 Trivy 결과를 공통 finding 모델로 정규화한다.
    List<UploadScanFinding> findings = new ArrayList<>();
    int findingIndex = 1;

    for (Path file : targetFiles) {
      String fileName = file.getFileName().toString();
      // Dockerfile/Containerfile만 Trivy 대상으로 실행한다.
      if (!isTrivyTargetFile(fileName)) {
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
          // 메시지 원문은 마스킹/정규화 후 evidence로 저장한다.
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              readText(misconfiguration, "ID", "UNKNOWN"),
              "trivy",
              normalizeSeverity(readText(misconfiguration, "Severity", "UNKNOWN")),
              resultFile,
              readStartLine(misconfiguration.path("CauseMetadata")),
              readText(misconfiguration, "Title", "Trivy misconfiguration"),
              truncateEvidence(TrivyEvidenceSanitizer.sanitizeEvidence(
                  readText(misconfiguration, "Message", "")
              ))
          ));
        }

        for (JsonNode vulnerability : result.path("Vulnerabilities")) {
          String vulnId = readText(vulnerability, "VulnerabilityID", "UNKNOWN");
          // 설명 원문은 마스킹/정규화 후 evidence로 저장한다.
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              vulnId,
              "trivy",
              normalizeSeverity(readText(vulnerability, "Severity", "UNKNOWN")),
              resultFile,
              null,
              readText(vulnerability, "Title", vulnId),
              truncateEvidence(TrivyEvidenceSanitizer.sanitizeEvidence(
                  readText(vulnerability, "Description", "")
              ))
          ));
        }

        for (JsonNode secret : result.path("Secrets")) {
          // Secret 원문은 그대로 남기지 않고 마스킹 값만 저장한다.
          findings.add(new UploadScanFinding(
              formatFindingId(findingIndex++),
              readText(secret, "RuleID", "UNKNOWN"),
              "trivy",
              normalizeSeverity(readText(secret, "Severity", "UNKNOWN")),
              resultFile,
              readInteger(secret, "StartLine"),
              readText(secret, "Title", "Trivy secret finding"),
              truncateEvidence(TrivyEvidenceSanitizer.sanitizeSecretMatch(
                  readText(secret, "Match", "")
              ))
          ));
        }
      }
    }

    return findings;
  }

  private JsonNode runTrivyConfig(Path targetFile) {
    // 로컬 프로세스로 Trivy를 실행하고 JSON 결과를 파싱한다.
    // 상대 경로 해석 이슈를 막기 위해 실행 디렉터리를 대상 파일의 부모 디렉터리로 맞춘다.
    Path parentDirectory = targetFile.toAbsolutePath().getParent();
    String targetPath = targetFile.toAbsolutePath().toString();

    List<String> command = List.of(
        trivyCommand,
        "config",
        "--quiet",
        "--format",
        "json",
        targetPath
    );
    ProcessBuilder processBuilder = new ProcessBuilder(command).redirectErrorStream(true);
    if (parentDirectory != null) {
      processBuilder.directory(parentDirectory.toFile());
    }

    try {
      Process process = processBuilder.start();
      ByteArrayOutputStream outputBuffer = new ByteArrayOutputStream();
      AtomicReference<Throwable> readFailure = new AtomicReference<>();

      Thread outputReader = Thread.startVirtualThread(() -> {
        try (var inputStream = process.getInputStream()) {
          inputStream.transferTo(outputBuffer);
        } catch (IOException ex) {
          readFailure.set(ex);
        } catch (RuntimeException ex) {
          readFailure.set(ex);
        }
      });

      boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
      if (!finished) {
        // timeout 초과 시 프로세스를 강제 종료한다.
        process.destroyForcibly();
        outputReader.join(1000);
        throw new IllegalStateException(
            "Trivy execution timed out after " + Duration.ofSeconds(timeoutSeconds)
        );
      }

      outputReader.join();
      Throwable outputReadFailure = readFailure.get();
      if (outputReadFailure != null) {
        if (outputReadFailure instanceof IOException ioEx) {
          throw new IllegalStateException("Failed to read Trivy output", ioEx);
        }
        throw new IllegalStateException("Failed to read Trivy output", outputReadFailure);
      }

      String output = outputBuffer.toString(StandardCharsets.UTF_8);
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
    } catch (UncheckedIOException ex) {
      throw new IllegalStateException("Failed to read Trivy output", ex.getCause());
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

  private boolean isTrivyTargetFile(String fileName) {
    return fileName.equals("Dockerfile") || fileName.equals("Containerfile");
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
    // 예외 로그에도 민감정보가 노출되지 않도록 먼저 sanitize 후 축약한다.
    String normalized = TrivyEvidenceSanitizer.sanitizeEvidence(text.replaceAll("\\s+", " ").trim());
    if (normalized.length() <= 300) {
      return normalized;
    }
    return normalized.substring(0, 300);
  }
}
