package com.ssafer.global.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required or token is invalid"),
  FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to access this resource"),
  NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"),
  DUPLICATE_EMAIL(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "Email is already registered"),
  DUPLICATE_DISPLAY_NAME(HttpStatus.CONFLICT, "DUPLICATE_DISPLAY_NAME", "Nickname is already in use"),
  INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect"),
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
  PASSWORD_RESET_CODE_INVALID(
      HttpStatus.BAD_REQUEST,
      "PASSWORD_RESET_CODE_INVALID",
      "Password reset verification code is invalid or expired"
  ),
  PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED(
      HttpStatus.TOO_MANY_REQUESTS,
      "PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED",
      "Password reset verification code attempts exceeded"
  ),
  PASSWORD_RESET_TOKEN_INVALID(
      HttpStatus.BAD_REQUEST,
      "PASSWORD_RESET_TOKEN_INVALID",
      "Password reset token is invalid or expired"
  ),
  EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT(
      HttpStatus.TOO_MANY_REQUESTS,
      "EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT",
      "Email verification code request is too frequent"
  ),
  EMAIL_DELIVERY_FAILED(HttpStatus.BAD_GATEWAY, "EMAIL_DELIVERY_FAILED", "Failed to deliver email"),
  INVALID_PARAMETER(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Request parameter format is invalid"),
  INVALID_PAYLOAD_HASH(HttpStatus.BAD_REQUEST, "INVALID_PAYLOAD_HASH", "payloadHash format is invalid"),
  RAW_RESULT_NOT_FOUND(HttpStatus.NOT_FOUND, "RAW_RESULT_NOT_FOUND", "Raw result object not found"),
  SCAN_STATUS_CONFLICT(
      HttpStatus.CONFLICT,
      "SCAN_STATUS_CONFLICT",
      "Operation is not allowed for current scan status"
  ),
  DUPLICATE_RAW_RESULT_UPLOAD(
      HttpStatus.CONFLICT,
      "DUPLICATE_RAW_RESULT_UPLOAD",
      "Raw result upload report was already submitted"
  ),
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
