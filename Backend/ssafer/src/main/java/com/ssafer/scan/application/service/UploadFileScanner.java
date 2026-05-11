package com.ssafer.scan.application.service;

import java.nio.file.Path;
import java.util.List;

public interface UploadFileScanner {

  // 업로드된 임시 파일 목록을 스캔하고 scan_result.json에 들어갈 공통 finding 모델로 반환한다.
  List<UploadScanFinding> scanAll(List<Path> targetFiles);
}
