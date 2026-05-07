package com.ssafer.scan.application.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class DefaultCustomRuleScanner implements CustomRuleScanner {

  private static final Pattern ENV_SENSITIVE_KEY = Pattern.compile(
      ".*(PASSWORD|SECRET|TOKEN|ACCESS_KEY|PRIVATE_KEY|API_KEY|AUTH).*"
  );
  private static final Pattern ENV_LINE = Pattern.compile("^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.+?)\\s*$");
  private static final Pattern ROOT_USER = Pattern.compile("^\\s*USER\\s+root\\s*$", Pattern.CASE_INSENSITIVE);
  private static final Pattern PRIVILEGED_TRUE = Pattern.compile("^\\s*privileged\\s*:\\s*true\\s*$", Pattern.CASE_INSENSITIVE);

  @Override
  public List<UploadScanFinding> scan(List<Path> targetFiles) {
    // 파일 종류별로 최소 규칙을 적용해 1차 커스텀 탐지를 수행한다.
    List<UploadScanFinding> findings = new ArrayList<>();
    int findingIndex = 1;

    for (Path file : targetFiles) {
      String fileName = file.getFileName().toString();
      try {
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        if (isEnvFile(fileName)) {
          findingIndex = scanEnvFile(fileName, lines, findings, findingIndex);
          continue;
        }
        if (isDockerLikeFile(fileName)) {
          findingIndex = scanDockerfile(fileName, lines, findings, findingIndex);
          continue;
        }
        if (isComposeFile(fileName)) {
          findingIndex = scanComposeFile(fileName, lines, findings, findingIndex);
        }
      } catch (IOException ex) {
        log.warn("Custom rule scan skipped for unreadable file: file={}", fileName, ex);
      }
    }
    return findings;
  }

  private int scanEnvFile(
      String fileName,
      List<String> lines,
      List<UploadScanFinding> findings,
      int startIndex
  ) {
    // .env 계열 파일에서 민감 키의 평문 할당을 탐지한다.
    int index = startIndex;
    for (int i = 0; i < lines.size(); i++) {
      String line = lines.get(i);
      var matcher = ENV_LINE.matcher(line);
      if (!matcher.matches()) {
        continue;
      }
      String key = matcher.group(1);
      String value = matcher.group(2);
      if (!ENV_SENSITIVE_KEY.matcher(key.toUpperCase(Locale.ROOT)).matches()) {
        continue;
      }
      if (value.isBlank() || value.equals("\"\"") || value.equals("''")) {
        continue;
      }

      findings.add(new UploadScanFinding(
          formatFindingId(index++),
          "ENV_PLAIN_SECRET",
          "custom-rule",
          "HIGH",
          fileName,
          i + 1,
          "환경변수 파일에 민감 정보가 평문으로 설정되어 있습니다.",
          maskEvidence(key)
      ));
    }
    return index;
  }

  private int scanDockerfile(
      String fileName,
      List<String> lines,
      List<UploadScanFinding> findings,
      int startIndex
  ) {
    // Dockerfile/Containerfile 에서 root 사용자 지정 여부를 탐지한다.
    int index = startIndex;
    for (int i = 0; i < lines.size(); i++) {
      if (!ROOT_USER.matcher(lines.get(i)).matches()) {
        continue;
      }
      findings.add(new UploadScanFinding(
          formatFindingId(index++),
          "DOCKERFILE_ROOT_USER",
          "custom-rule",
          "MEDIUM",
          fileName,
          i + 1,
          "컨테이너 실행 사용자가 root로 설정되어 있습니다.",
          "USER root"
      ));
    }
    return index;
  }

  private int scanComposeFile(
      String fileName,
      List<String> lines,
      List<UploadScanFinding> findings,
      int startIndex
  ) {
    // compose 계열 파일에서 privileged 모드 활성화를 탐지한다.
    int index = startIndex;
    for (int i = 0; i < lines.size(); i++) {
      if (!PRIVILEGED_TRUE.matcher(lines.get(i)).matches()) {
        continue;
      }
      findings.add(new UploadScanFinding(
          formatFindingId(index++),
          "COMPOSE_PRIVILEGED_MODE",
          "custom-rule",
          "HIGH",
          fileName,
          i + 1,
          "privileged 모드가 활성화되어 있습니다.",
          "privileged: true"
      ));
    }
    return index;
  }

  private boolean isEnvFile(String fileName) {
    return fileName.equals(".env") || fileName.startsWith(".env.");
  }

  private boolean isDockerLikeFile(String fileName) {
    return fileName.equals("Dockerfile") || fileName.equals("Containerfile");
  }

  private boolean isComposeFile(String fileName) {
    return fileName.startsWith("docker-compose") || fileName.startsWith("compose");
  }

  private String formatFindingId(int index) {
    return String.format("FND-%04d", index);
  }

  private String maskEvidence(String key) {
    return key + "=***MASKED***";
  }
}
