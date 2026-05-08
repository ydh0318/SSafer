package com.ssafer.scan.application.service;

import java.nio.file.Path;
import java.util.List;

public interface TrivyScanExecutor {

  // 업로드된 파일 목록을 Trivy로 스캔해 finding 목록을 반환한다.
  List<UploadScanFinding> scan(List<Path> targetFiles);
}
