package com.ssafer.scan.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class UploadScanToolMetadata {

  private final String toolName;
  private final String toolVersion;

  public UploadScanToolMetadata(
      @Value("${ssafer.upload-scan.tool-name:ssafer-web-upload}") String toolName,
      @Value("${ssafer.upload-scan.tool-version:0.1.0}") String toolVersion
  ) {
    // 업로드 스캔에서 Worker로 전달할 도구 식별자/버전을 설정값으로 주입한다.
    this.toolName = toolName;
    this.toolVersion = toolVersion;
  }

  public String toolName() {
    return toolName;
  }

  public String toolVersion() {
    return toolVersion;
  }
}
