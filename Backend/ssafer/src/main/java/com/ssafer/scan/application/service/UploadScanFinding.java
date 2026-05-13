package com.ssafer.scan.application.service;

import java.util.List;

public record UploadScanFinding(
    // 초기 탐지 결과의 식별자(최종 JSON 직렬화 시 재번호 부여 가능)
    String id,
    // 룰 식별자 (예: ENV_PLAIN_SECRET, DS002)
    String ruleId,
    // 탐지 출처 (trivy / custom-rule)
    String source,
    String severity,
    String file,
    Integer line,
    String title,
    String maskedEvidence,
    // 웹 업로드에서는 서버 임시 경로가 아니라 업로드 파일을 식별할 상대 경로/파일명을 사용한다.
    String filePath,
    List<String> targetFiles,
    // AI가 diff용 patch를 만들 때 사용할 원본 코드 컨텍스트다.
    UploadScanFindingPatchContext patchContext
) {

  public UploadScanFinding {
    targetFiles = targetFiles == null ? List.of() : List.copyOf(targetFiles);
  }

  public UploadScanFinding(
      String id,
      String ruleId,
      String source,
      String severity,
      String file,
      Integer line,
      String title,
      String maskedEvidence
  ) {
    this(id, ruleId, source, severity, file, line, title, maskedEvidence, null, null, null);
  }

  public UploadScanFinding(
      String id,
      String ruleId,
      String source,
      String severity,
      String file,
      Integer line,
      String title,
      String maskedEvidence,
      String filePath,
      UploadScanFindingPatchContext patchContext
  ) {
    this(id, ruleId, source, severity, file, line, title, maskedEvidence, filePath, null, patchContext);
  }

  public UploadScanFinding withPatchContext(String filePath, UploadScanFindingPatchContext patchContext) {
    // record는 불변 객체이므로 patchContext가 추가된 새 finding을 만들어 반환한다.
    return new UploadScanFinding(
        id,
        ruleId,
        source,
        severity,
        file,
        line,
        title,
        maskedEvidence,
        filePath,
        targetFiles,
        patchContext
    );
  }
}
