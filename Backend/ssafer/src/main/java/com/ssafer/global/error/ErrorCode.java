package com.ssafer.global.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required or token is invalid"),
  FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to access this resource"),
  NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"),
  DUPLICATE_EMAIL(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "Email is already registered"),
  EMAIL_VERIFICATION_REQUIRED(
      HttpStatus.BAD_REQUEST,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verified email is required before registration"
  ),
  EMAIL_VERIFICATION_CODE_INVALID(
      HttpStatus.BAD_REQUEST,
      "EMAIL_VERIFICATION_CODE_INVALID",
      "Email verification code is invalid or expired"
  ),
  EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT(
      HttpStatus.TOO_MANY_REQUESTS,
      "EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT",
      "Email verification code request is too frequent"
  ),
  EMAIL_DELIVERY_FAILED(HttpStatus.BAD_GATEWAY, "EMAIL_DELIVERY_FAILED", "Failed to deliver email"),
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
