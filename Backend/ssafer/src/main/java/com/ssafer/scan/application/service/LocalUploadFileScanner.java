package com.ssafer.scan.application.service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.scan.engine.enabled", havingValue = "false")
public class LocalUploadFileScanner implements UploadFileScanner {

  private final CustomRuleScanner customRuleScanner;
  private final TrivyScanExecutor trivyScanExecutor;

  @Override
  public UploadFileScanResult scanAll(List<Path> targetFiles) {
    // engine 비활성화 시에만 기존 Spring 내부 스캐너 조합으로 fallback 한다.
    List<UploadScanFinding> findings = new ArrayList<>();
    findings.addAll(customRuleScanner.scan(targetFiles));
    findings.addAll(trivyScanExecutor.scan(targetFiles));
    return new UploadFileScanResult(findings, List.of(), null, null, null, true);
  }
}
