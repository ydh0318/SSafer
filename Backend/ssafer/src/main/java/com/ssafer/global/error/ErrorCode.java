package com.ssafer.global.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required or token is invalid"),
  FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to access this resource"),
  NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"),
  INVALID_PARAMETER(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Request parameter format is invalid"),
  INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "Internal server error");

  private final HttpStatus status;
  private final String code;
  private final String message;

  ErrorCode(HttpStatus status, String code, String message) {
    this.status = status;
    this.code = code;
    this.message = message;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }

  public String message() {
    return message;
  }
}
