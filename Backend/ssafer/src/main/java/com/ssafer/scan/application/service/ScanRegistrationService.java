package com.ssafer.scan.application.service;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.scan.api.dto.CreateScanRequest;
import org.springframework.stereotype.Service;

@Service
// 스캔 시작 등록 유스케이스의 진입점.
public class ScanRegistrationService {

  public ScanRegistrationResult register(AuthenticatedActor actor, CreateScanRequest request) {
    throw new UnsupportedOperationException("Scan registration is not implemented yet");
  }
}
