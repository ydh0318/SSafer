package com.ssafer.global.logging;

import jakarta.servlet.http.HttpServletRequest;

public final class ApiLogContext {

  public static final String REQUEST_ID_ATTRIBUTE = ApiLogContext.class.getName() + ".requestId";
  public static final String FAILURE_STAGE_ATTRIBUTE = ApiLogContext.class.getName() + ".failureStage";
  public static final String FAILURE_REASON_ATTRIBUTE = ApiLogContext.class.getName() + ".failureReason";

  private ApiLogContext() {
  }

  public static void setRequestId(HttpServletRequest request, String requestId) {
    request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
  }

  public static String getRequestId(HttpServletRequest request) {
    Object value = request.getAttribute(REQUEST_ID_ATTRIBUTE);
    return value instanceof String requestId ? requestId : "-";
  }

  public static void markFailure(HttpServletRequest request, String stage, String reason) {
    markFailureStage(request, stage);
    markFailureReason(request, reason);
  }

  public static void markFailureStage(HttpServletRequest request, String stage) {
    // 가장 먼저 기록된 실패 지점을 유지해야 "어디서 막혔는지"가 뒤섞이지 않는다.
    if (stage == null || stage.isBlank() || request.getAttribute(FAILURE_STAGE_ATTRIBUTE) != null) {
      return;
    }
    request.setAttribute(FAILURE_STAGE_ATTRIBUTE, stage);
  }

  public static void markFailureReason(HttpServletRequest request, String reason) {
    // 실패 사유도 최초 원인을 보존한다.
    if (reason == null || reason.isBlank() || request.getAttribute(FAILURE_REASON_ATTRIBUTE) != null) {
      return;
    }
    request.setAttribute(FAILURE_REASON_ATTRIBUTE, reason);
  }

  public static String getFailureStage(HttpServletRequest request) {
    Object value = request.getAttribute(FAILURE_STAGE_ATTRIBUTE);
    return value instanceof String stage ? stage : null;
  }

  public static String getFailureReason(HttpServletRequest request) {
    Object value = request.getAttribute(FAILURE_REASON_ATTRIBUTE);
    return value instanceof String reason ? reason : null;
  }
}
