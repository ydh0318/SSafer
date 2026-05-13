package com.ssafer.scan.application.service;

import java.util.List;
import java.util.Map;

public record UploadFileScanResult(
    List<UploadScanFinding> findings,
    List<String> warnings,
    Map<String, String> sourceFileHashes,
    Map<String, Object> targets,
    Map<String, Object> summary,
    boolean patchContextFallbackAllowed
) {

  public UploadFileScanResult(
      List<UploadScanFinding> findings,
      List<String> warnings,
      Map<String, String> sourceFileHashes,
      Map<String, Object> targets,
      Map<String, Object> summary
  ) {
    this(findings, warnings, sourceFileHashes, targets, summary, false);
  }

  public UploadFileScanResult {
    findings = findings == null ? List.of() : List.copyOf(findings);
    warnings = warnings == null ? List.of() : List.copyOf(warnings);
    sourceFileHashes = sourceFileHashes == null ? Map.of() : Map.copyOf(sourceFileHashes);
    targets = targets == null ? Map.of() : Map.copyOf(targets);
    summary = summary == null ? Map.of() : Map.copyOf(summary);
  }

  public UploadFileScanResult withFindings(List<UploadScanFinding> findings) {
    return new UploadFileScanResult(findings, warnings, sourceFileHashes, targets, summary, patchContextFallbackAllowed);
  }
}
