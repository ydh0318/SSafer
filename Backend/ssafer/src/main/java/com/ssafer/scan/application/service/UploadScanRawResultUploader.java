package com.ssafer.scan.application.service;

import java.nio.file.Path;

public interface UploadScanRawResultUploader {

  String upload(Long scanId, Path scanResultJsonPath);
}
