package com.ssafer.scan.application.service;

public record UploadScanFindingPatchContext(
    String operation,
    String type,
    String target,
    // finding이 가리키는 원본 코드 한 줄이다. AI patch의 oldText 기준으로 사용된다.
    String oldText,
    // 현재 MVP는 단일 라인 컨텍스트만 지원하므로 시작/끝 라인이 같다.
    Integer lineStart,
    Integer lineEnd,
    // 업로드 당시 파일 내용 hash다. diff/patch 생성 시 원본 파일 기준을 고정한다.
    String expectedFileHash
) {

  public UploadScanFindingPatchContext(
      String oldText,
      Integer lineStart,
      Integer lineEnd,
      String expectedFileHash
  ) {
    this(null, null, null, oldText, lineStart, lineEnd, expectedFileHash);
  }
}
