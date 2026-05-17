package com.ssafer.worker.domain.enums;

public enum WorkerJobStatus {
  PENDING,
  PUBLISHED,
  RUNNING,
  SUCCEEDED,
  FAILED,
  CANCELED;

  public boolean isTerminal() {
    return this == SUCCEEDED || this == FAILED || this == CANCELED;
  }

  public void assertTransitionAllowed(WorkerJobStatus nextStatus) {
    if (this == nextStatus) {
      return;
    }

    boolean allowed = switch (this) {
      case PENDING -> nextStatus == PUBLISHED || nextStatus == CANCELED;
      case PUBLISHED -> nextStatus == RUNNING || nextStatus == FAILED || nextStatus == CANCELED;
      case RUNNING -> nextStatus == SUCCEEDED || nextStatus == FAILED || nextStatus == CANCELED;
      case SUCCEEDED, FAILED, CANCELED -> false;
    };

    if (!allowed) {
      throw new IllegalStateException("WorkerJob status transition is not allowed: " + this + " -> " + nextStatus);
    }
  }
}
