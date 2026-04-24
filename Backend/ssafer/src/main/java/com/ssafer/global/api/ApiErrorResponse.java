package com.ssafer.global.api;

import java.util.Map;

public record ApiErrorResponse(
    String code,
    String message,
    Map<String, Object> data
) {

  public static ApiErrorResponse of(String code, String message) {
    return new ApiErrorResponse(code, message, Map.of());
  }
}
