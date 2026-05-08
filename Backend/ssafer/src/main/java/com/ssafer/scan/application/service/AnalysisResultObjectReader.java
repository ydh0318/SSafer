package com.ssafer.scan.application.service;

// analysisResultPath가 가리키는 S3 결과 파일을 문자열로 읽어오는 추상화다.
public interface AnalysisResultObjectReader {

  String read(String analysisResultPath);
}
