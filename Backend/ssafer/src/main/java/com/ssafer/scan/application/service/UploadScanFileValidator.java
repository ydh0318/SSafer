package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class UploadScanFileValidator {

  private static final int MAX_FILE_COUNT = 3;
  private static final long MAX_TOTAL_BYTES = 1_048_576L;

  private static final Pattern ENV_PATTERN = Pattern.compile("^\\.env$");
  private static final Pattern ENV_PROFILE_PATTERN = Pattern.compile("^\\.env\\.[A-Za-z0-9_-]+$");
  private static final Pattern DOCKERFILE_PATTERN = Pattern.compile("^Dockerfile$");
  private static final Pattern CONTAINERFILE_PATTERN = Pattern.compile("^Containerfile$");
  private static final Pattern DOCKER_COMPOSE_PATTERN = Pattern.compile("^docker-compose(\\.[A-Za-z0-9_-]+)?\\.ya?ml$");
  private static final Pattern COMPOSE_PATTERN = Pattern.compile("^compose(\\.[A-Za-z0-9_-]+)?\\.ya?ml$");

  public void validate(List<MultipartFile> files) {
    // 파일 목록 자체 검증: 누락/개수 제한
    if (files == null || files.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    if (files.size() > MAX_FILE_COUNT) {
      throw new BusinessException(ErrorCode.FILE_COUNT_EXCEEDED);
    }

    // 총 업로드 용량(합계) 제한: 1MB
    long totalBytes = 0L;
    for (MultipartFile file : files) {
      validateSingleFile(file);
      totalBytes += file.getSize();
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new BusinessException(ErrorCode.PAYLOAD_TOO_LARGE);
      }
    }
  }

  private void validateSingleFile(MultipartFile file) {
    // 빈 파일/0 byte 파일 차단
    if (file == null || file.isEmpty() || file.getSize() <= 0L) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String originalFilename = file.getOriginalFilename();
    if (originalFilename == null || originalFilename.isBlank()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // basename 기준 검증: 경로 조작 문자열 차단
    String basename = Path.of(originalFilename).getFileName().toString();
    if (!originalFilename.equals(basename)) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    if (basename.contains("/") || basename.contains("\\")) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 허용된 파일명 패턴만 통과
    if (!isAllowedFilename(basename)) {
      throw new BusinessException(ErrorCode.UNSUPPORTED_FILE_TYPE);
    }
  }

  private boolean isAllowedFilename(String basename) {
    return ENV_PATTERN.matcher(basename).matches()
        || ENV_PROFILE_PATTERN.matcher(basename).matches()
        || DOCKERFILE_PATTERN.matcher(basename).matches()
        || CONTAINERFILE_PATTERN.matcher(basename).matches()
        || DOCKER_COMPOSE_PATTERN.matcher(basename).matches()
        || COMPOSE_PATTERN.matcher(basename).matches();
  }
}
