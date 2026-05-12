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
import org.springframework.stereotype.Component;

@Component
public class UploadScanFindingPatchContextEnricher {

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
    if (finding == null || finding.patchContext() != null || finding.line() == null || finding.line() < 1) {
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

      String oldText = lines.get(lineIndex);
      if (oldText == null || oldText.isBlank()) {
        return finding;
      }

      UploadScanFindingPatchContext patchContext = new UploadScanFindingPatchContext(
          oldText,
          finding.line(),
          finding.line(),
          calculateFileHash(matchedFile)
      );
      // 서버 내부 임시 경로는 노출하지 않고 업로드 파일명만 filePath로 넘긴다.
      return finding.withPatchContext(matchedFile.getFileName().toString(), patchContext);
    } catch (IOException ex) {
      return finding;
    }
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
}
