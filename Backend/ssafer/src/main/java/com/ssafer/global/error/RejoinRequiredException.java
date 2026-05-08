package com.ssafer.global.error;

public class RejoinRequiredException extends BusinessException {

  private final String rejoinToken;

  public RejoinRequiredException(String rejoinToken) {
    super(ErrorCode.REJOIN_REQUIRED);
    this.rejoinToken = rejoinToken;
  }

  public String getRejoinToken() {
    return rejoinToken;
  }
}
