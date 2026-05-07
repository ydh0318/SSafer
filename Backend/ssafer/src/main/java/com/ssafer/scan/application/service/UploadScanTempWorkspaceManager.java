package com.ssafer.scan.application.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
@Slf4j
public class UploadScanTempWorkspaceManager {

  @Value("${APP_SCAN_UPLOAD_TEMP_ROOT:/tmp/ssafer/uploads}")
  private String tempRoot;

  public Path createWorkspace(Long scanId) {
    try {
      // scanId별 임시 워크스페이스를 생성한다.
      Path workspace = Path.of(tempRoot, String.valueOf(scanId), UUID.randomUUID().toString());
      Files.createDirectories(workspace);
      return workspace;
    } catch (IOException ex) {
      throw new IllegalStateException("Failed to create upload temp workspace", ex);
    }
  }

  public List<Path> saveFiles(Path workspace, List<MultipartFile> multipartFiles) {
    // multipart 파일을 임시 디렉토리로 저장한다.
    List<Path> savedFiles = new ArrayList<>();
    for (MultipartFile multipartFile : multipartFiles) {
      String originalFileName = multipartFile.getOriginalFilename();
      if (originalFileName == null || originalFileName.isBlank()) {
        throw new IllegalStateException("Uploaded file name is blank");
      }

      Path targetFile = workspace.resolve(originalFileName);
      try {
        multipartFile.transferTo(targetFile);
        savedFiles.add(targetFile);
      } catch (IOException ex) {
        throw new IllegalStateException("Failed to save upload file into temp workspace", ex);
      }
    }
    return savedFiles;
  }

  public void cleanup(Path workspace) {
    // 성공/실패와 관계없이 임시 파일을 역순으로 정리한다.
    if (workspace == null) {
      return;
    }
    try (var walk = Files.walk(workspace)) {
      walk.sorted(Comparator.reverseOrder()).forEach(path -> {
        try {
          Files.deleteIfExists(path);
        } catch (IOException ex) {
          log.warn("Failed to delete upload temp file: path={}", path, ex);
        }
      });
    } catch (IOException ex) {
      log.warn("Failed to cleanup upload temp workspace: path={}", workspace, ex);
    }
  }
}
