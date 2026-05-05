package com.ssafer.scan.domain.enums;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;

public enum ScanStatus {
  REQUESTED,
  QUEUED,
  RUNNING,
  RAW_UPLOADED,
  DONE,
  FAILED,
  CANCELED;

  // scan 처리 흐름에서 허용할 상태 전이 규칙이다.
  private static final Map<ScanStatus, EnumSet<ScanStatus>> ALLOWED_TRANSITIONS = buildAllowedTransitions();

  // 실제 처리 완료됐거나 명시적으로 중단된 상태만 종료 상태로 본다.
  public boolean isTerminal() {
    return this == DONE || this == FAILED || this == CANCELED;
  }

  public boolean canTransitionTo(ScanStatus nextStatus) {
    if (this == nextStatus) {
      return true;
    }
    return ALLOWED_TRANSITIONS.getOrDefault(this, EnumSet.noneOf(ScanStatus.class)).contains(nextStatus);
  }

  public void assertTransitionAllowed(ScanStatus nextStatus) {
    if (!canTransitionTo(nextStatus)) {
      throw new IllegalStateException("Scan status transition is not allowed: " + this + " -> " + nextStatus);
    }
  }

  private static Map<ScanStatus, EnumSet<ScanStatus>> buildAllowedTransitions() {
    Map<ScanStatus, EnumSet<ScanStatus>> transitions = new EnumMap<>(ScanStatus.class);
    transitions.put(REQUESTED, EnumSet.of(RAW_UPLOADED, QUEUED, FAILED, CANCELED));
    transitions.put(RAW_UPLOADED, EnumSet.of(QUEUED, RUNNING, DONE, FAILED, CANCELED));
    transitions.put(QUEUED, EnumSet.of(RAW_UPLOADED, RUNNING, FAILED, CANCELED));
    transitions.put(RUNNING, EnumSet.of(RAW_UPLOADED, DONE, FAILED, CANCELED));
    transitions.put(DONE, EnumSet.noneOf(ScanStatus.class));
    transitions.put(FAILED, EnumSet.noneOf(ScanStatus.class));
    transitions.put(CANCELED, EnumSet.noneOf(ScanStatus.class));
    return transitions;
  }
}
