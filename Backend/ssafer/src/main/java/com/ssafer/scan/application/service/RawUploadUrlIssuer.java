package com.ssafer.scan.application.service;

// raw 결과 파일 업로드용 URL 발급 추상화.
// 구현체는 presigned URL 또는 다른 방식으로 교체할 수 있다.
public interface RawUploadUrlIssuer {

  String issuePutUrl(String objectKey);
}
