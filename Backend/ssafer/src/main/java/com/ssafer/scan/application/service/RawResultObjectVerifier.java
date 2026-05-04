package com.ssafer.scan.application.service;

// rawResultPath가 가리키는 객체의 실제 존재 여부를 확인하는 추상화.
public interface RawResultObjectVerifier {

  boolean exists(String rawResultPath);
}
