package com.ssafer.scan.domain.enums;

public enum ScanStatus {
  REQUESTED,
  QUEUED,
  RUNNING,
  RAW_UPLOADED,
  DONE,
  FAILED,
  CANCELED;

  // 실제 처리 완료이거나 명시적으로 중단된 상태만 종료 상태로 본다.
  public boolean isTerminal() {
    return this == DONE || this == FAILED || this == CANCELED;
  }
}
