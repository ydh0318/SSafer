package com.ssafer.scan.application.service;

import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ScanExecutionPermit {

  private final Semaphore semaphore;

  public ScanExecutionPermit(@Value("${APP_SCAN_UPLOAD_MAX_CONCURRENT:2}") int maxConcurrent) {
    // 잘못된 설정값(0 이하) 방어: 최소 1개 permit 보장
    int permits = Math.max(1, maxConcurrent);
    this.semaphore = new Semaphore(permits);
  }

  public boolean tryAcquire() {
    // 대기 없이 즉시 획득 시도 (실패 시 busy 응답 처리)
    return semaphore.tryAcquire();
  }

  public void release() {
    // 호출한 쪽에서 finally로 반환하는 것을 전제
    semaphore.release();
  }
}
