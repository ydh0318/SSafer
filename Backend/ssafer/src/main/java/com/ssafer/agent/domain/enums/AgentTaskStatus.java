package com.ssafer.agent.domain.enums;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

public enum AgentTaskStatus {
  PENDING,
  SENT,
  ACKED,
  RUNNING,
  SUCCEEDED,
  FAILED,
  CANCELED;

  // 재연결된 agent가 다시 가져가도 되는 미완료 상태 집합이다.
  private static final EnumSet<AgentTaskStatus> RESEND_TARGETS = EnumSet.of(PENDING, SENT, ACKED, RUNNING);
  // 더 이상 상태가 바뀌지 않는 종료 상태 집합이다.
  private static final EnumSet<AgentTaskStatus> TERMINAL_STATUSES = EnumSet.of(SUCCEEDED, FAILED, CANCELED);
  // 작업 큐 발행 이후 허용할 상태 전이 규칙이다.
  private static final Map<AgentTaskStatus, EnumSet<AgentTaskStatus>> ALLOWED_TRANSITIONS =
      buildAllowedTransitions();

  public static List<AgentTaskStatus> resendTargetStatuses() {
    return List.copyOf(RESEND_TARGETS);
  }

  public boolean isResendTarget() {
    return RESEND_TARGETS.contains(this);
  }

  public boolean isTerminal() {
    return TERMINAL_STATUSES.contains(this);
  }

  public boolean canTransitionTo(AgentTaskStatus nextStatus) {
    if (this == nextStatus) {
      return true;
    }
    return ALLOWED_TRANSITIONS.getOrDefault(this, EnumSet.noneOf(AgentTaskStatus.class)).contains(nextStatus);
  }

  public void assertTransitionAllowed(AgentTaskStatus nextStatus) {
    if (!canTransitionTo(nextStatus)) {
      throw new IllegalStateException("AgentTask status transition is not allowed: " + this + " -> " + nextStatus);
    }
  }

  private static Map<AgentTaskStatus, EnumSet<AgentTaskStatus>> buildAllowedTransitions() {
    Map<AgentTaskStatus, EnumSet<AgentTaskStatus>> transitions = new EnumMap<>(AgentTaskStatus.class);
    transitions.put(PENDING, EnumSet.of(SENT, CANCELED));
    transitions.put(SENT, EnumSet.of(ACKED, FAILED, CANCELED));
    transitions.put(ACKED, EnumSet.of(RUNNING, FAILED, CANCELED));
    transitions.put(RUNNING, EnumSet.of(SUCCEEDED, FAILED, CANCELED));
    transitions.put(SUCCEEDED, EnumSet.noneOf(AgentTaskStatus.class));
    transitions.put(FAILED, EnumSet.noneOf(AgentTaskStatus.class));
    transitions.put(CANCELED, EnumSet.noneOf(AgentTaskStatus.class));
    return transitions;
  }
}
