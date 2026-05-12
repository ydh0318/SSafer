package com.ssafer.scan.application.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class UploadScanFindingPatchContextEnricher {

  private static final String COMPOSE_EXPOSED_DB_PORT = "COMPOSE_EXPOSED_DB_PORT";
  private static final Set<String> SENSITIVE_RULE_IDS = Set.of(
      "ENV_PLAIN_SECRET",
      "COMPOSE_HARDCODED_SECRET"
  );
  private static final List<String> SENSITIVE_KEYWORDS = List.of(
      "SECRET",
      "PASSWORD",
      "TOKEN",
      "API KEY",
      "API_KEY",
      "ACCESS KEY",
      "ACCESS_KEY",
      "PRIVATE KEY",
      "PRIVATE_KEY",
      "CREDENTIAL"
  );
  private static final Pattern SENSITIVE_ASSIGNMENT = Pattern.compile(
      ".*(PASSWORD|SECRET|TOKEN|ACCESS_KEY|PRIVATE_KEY|API_KEY|CREDENTIAL).*[:=].*",
      Pattern.CASE_INSENSITIVE
  );

  public List<UploadScanFinding> enrich(List<UploadScanFinding> findings, List<Path> uploadedFiles) {
    // 웹 업로드 스캔 결과에 AI diff 생성을 위한 원본 코드 컨텍스트를 보강한다.
    if (findings == null || findings.isEmpty() || uploadedFiles == null || uploadedFiles.isEmpty()) {
      return findings == null ? List.of() : findings;
    }

    List<UploadScanFinding> enrichedFindings = new ArrayList<>(findings.size());
    for (UploadScanFinding finding : findings) {
      enrichedFindings.add(enrich(finding, uploadedFiles));
    }
    return enrichedFindings;
  }

  private UploadScanFinding enrich(UploadScanFinding finding, List<Path> uploadedFiles) {
    // 이미 엔진이 patchContext를 내려준 경우에는 백엔드가 덮어쓰지 않는다.
    if (finding == null || finding.patchContext() != null || isSensitiveFinding(finding)
        || finding.line() == null || finding.line() < 1) {
      return finding;
    }

    Path matchedFile = findUniqueFile(finding.file(), uploadedFiles);
    if (matchedFile == null) {
      return finding;
    }

    try {
      List<String> lines = Files.readAllLines(matchedFile, StandardCharsets.UTF_8);
      int lineIndex = finding.line() - 1;
      if (lineIndex >= lines.size()) {
        return finding;
      }

      LineTextRange textRange = extractPatchTextRange(finding, lines, lineIndex);
      String oldText = textRange.oldText();
      if (oldText == null || oldText.isBlank()) {
        return finding;
      }
      // CLI와 동일하게 secret 계열 원문은 oldText로 내보내지 않는다.
      if (SENSITIVE_ASSIGNMENT.matcher(oldText).matches()) {
        return finding;
      }

      UploadScanFindingPatchContext patchContext = new UploadScanFindingPatchContext(
          oldText,
          textRange.lineStart(),
          textRange.lineEnd(),
          calculateFileHash(matchedFile)
      );
      // 서버 내부 임시 경로는 노출하지 않고 업로드 파일명만 filePath로 넘긴다.
      return finding.withPatchContext(matchedFile.getFileName().toString(), patchContext);
    } catch (IOException ex) {
      return finding;
    }
  }

  private LineTextRange extractPatchTextRange(UploadScanFinding finding, List<String> lines, int lineIndex) {
    if (COMPOSE_EXPOSED_DB_PORT.equals(normalize(finding.ruleId()))) {
      return extractYamlBlockTextRange(lines, lineIndex);
    }
    return new LineTextRange(lines.get(lineIndex), lineIndex + 1, lineIndex + 1);
  }

  private LineTextRange extractYamlBlockTextRange(List<String> lines, int lineIndex) {
    String startLine = lines.get(lineIndex);
    if (!isYamlKeyLine(startLine, "ports")) {
      return new LineTextRange(startLine, lineIndex + 1, lineIndex + 1);
    }

    int startIndent = indentWidth(startLine);
    int endIndex = lineIndex;
    for (int index = lineIndex + 1; index < lines.size(); index++) {
      String line = lines.get(index);
      if (line.isBlank()) {
        break;
      }
      if (indentWidth(line) <= startIndent) {
        break;
      }
      endIndex = index;
    }

    String oldText = String.join("\n", lines.subList(lineIndex, endIndex + 1));
    return new LineTextRange(oldText, lineIndex + 1, endIndex + 1);
  }

  private boolean isYamlKeyLine(String line, String expectedKey) {
    String trimmed = line == null ? "" : line.strip();
    if (trimmed.isBlank() || trimmed.startsWith("-") || !trimmed.contains(":")) {
      return false;
    }
    String key = trimmed.split(":", 2)[0].strip().replace("\"", "").replace("'", "");
    return expectedKey.equals(key);
  }

  private int indentWidth(String line) {
    int width = 0;
    while (width < line.length() && line.charAt(width) == ' ') {
      width++;
    }
    return width;
  }

  private Path findUniqueFile(String findingFile, List<Path> uploadedFiles) {
    // 같은 파일명이 2개 이상이면 어느 파일의 oldText인지 확정할 수 없으므로 생략한다.
    String findingFileName = extractFileName(findingFile);
    if (findingFileName == null || findingFileName.isBlank()) {
      return null;
    }

    List<Path> matches = uploadedFiles.stream()
        .filter(path -> path != null && path.getFileName() != null)
        .filter(path -> path.getFileName().toString().equals(findingFileName))
        .toList();

    return matches.size() == 1 ? matches.getFirst() : null;
  }

  private boolean isSensitiveFinding(UploadScanFinding finding) {
    if (SENSITIVE_RULE_IDS.contains(normalize(finding.ruleId()))) {
      return true;
    }
    if (isEnvFile(finding.file()) || isEnvFile(finding.filePath())) {
      return true;
    }
    if (!"trivy".equalsIgnoreCase(finding.source())) {
      return false;
    }
    String searchable = normalize(String.join(" ",
        nullToEmpty(finding.ruleId()),
        nullToEmpty(finding.title()),
        nullToEmpty(finding.maskedEvidence())
    ));
    return SENSITIVE_KEYWORDS.stream().anyMatch(searchable::contains);
  }

  private boolean isEnvFile(String path) {
    String fileName = extractFileName(path);
    return fileName != null && (fileName.equals(".env") || fileName.startsWith(".env."));
  }

  private String normalize(String value) {
    return nullToEmpty(value).toUpperCase(Locale.ROOT);
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private String extractFileName(String path) {
    if (path == null || path.isBlank()) {
      return null;
    }
    String normalized = path.replace('\\', '/');
    int separatorIndex = normalized.lastIndexOf('/');
    if (separatorIndex >= 0 && separatorIndex + 1 < normalized.length()) {
      return normalized.substring(separatorIndex + 1);
    }
    return normalized;
  }

  private String calculateFileHash(Path file) throws IOException {
    try {
      byte[] content = Files.readAllBytes(file);
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return "sha256:" + toHex(digest.digest(content));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is not available", ex);
    }
  }

  private String toHex(byte[] bytes) {
    StringBuilder builder = new StringBuilder(bytes.length * 2);
    for (byte value : bytes) {
      builder.append(String.format(Locale.ROOT, "%02x", value));
    }
    return builder.toString();
  }

  private record LineTextRange(
      String oldText,
      Integer lineStart,
      Integer lineEnd
  ) {
  }
}
