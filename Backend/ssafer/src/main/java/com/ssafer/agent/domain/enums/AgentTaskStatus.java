package com.ssafer.agent.domain.enums;

import java.util.EnumSet;
import java.util.List;

public enum AgentTaskStatus {
  PENDING,
  SENT,
  ACKED,
  RUNNING,
  SUCCEEDED,
  FAILED,
  CANCELED;

  // 재연결 시 재전송 대상으로 간주할 미완료 상태 집합
  private static final EnumSet<AgentTaskStatus> RESEND_TARGETS = EnumSet.of(PENDING, SENT, ACKED, RUNNING);
  // 더 이상 재전송/진행되지 않는 종료 상태 집합
  private static final EnumSet<AgentTaskStatus> TERMINAL_STATUSES = EnumSet.of(SUCCEEDED, FAILED, CANCELED);

  public static List<AgentTaskStatus> resendTargetStatuses() {
    return List.copyOf(RESEND_TARGETS);
  }

  public boolean isResendTarget() {
    return RESEND_TARGETS.contains(this);
  }

  public boolean isTerminal() {
    return TERMINAL_STATUSES.contains(this);
  }
}
