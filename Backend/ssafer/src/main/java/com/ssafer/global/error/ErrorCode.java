package com.ssafer.global.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required or token is invalid"),
  FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to access this resource"),
  NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"),
  DUPLICATE_EMAIL(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "Email is already registered"),
  DUPLICATE_DISPLAY_NAME(HttpStatus.CONFLICT, "DUPLICATE_DISPLAY_NAME", "Nickname is already in use"),
  SOCIAL_ACCOUNT_ALREADY_LINKED(
      HttpStatus.CONFLICT,
      "SOCIAL_ACCOUNT_ALREADY_LINKED",
      "Social account is already linked"
  ),
  SOCIAL_ACCOUNT_NOT_LINKED(
      HttpStatus.NOT_FOUND,
      "SOCIAL_ACCOUNT_NOT_LINKED",
      "Social account is not linked"
  ),
  SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED(
      HttpStatus.CONFLICT,
      "SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED",
      "Cannot disconnect the last available sign-in method"
  ),
  REJOIN_REQUIRED(
      HttpStatus.CONFLICT,
      "REJOIN_REQUIRED",
      "Rejoin confirmation is required for the withdrawn account"
  ),
  OAUTH_AUTHENTICATION_FAILED(
      HttpStatus.UNAUTHORIZED,
      "OAUTH_AUTHENTICATION_FAILED",
      "OAuth authentication failed"
  ),
  OAUTH_PROVIDER_UNAVAILABLE(
      HttpStatus.BAD_GATEWAY,
      "OAUTH_PROVIDER_UNAVAILABLE",
      "OAuth provider is unavailable"
  ),
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
  FILE_COUNT_EXCEEDED(
      HttpStatus.BAD_REQUEST,
      "FILE_COUNT_EXCEEDED",
      "Upload file count exceeded"
  ),
  UNSUPPORTED_FILE_TYPE(
      HttpStatus.BAD_REQUEST,
      "UNSUPPORTED_FILE_TYPE",
      "Unsupported upload file type"
  ),
  PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "Payload too large"),
  SCAN_EXECUTION_BUSY(
      HttpStatus.TOO_MANY_REQUESTS,
      "SCAN_EXECUTION_BUSY",
      "Scan execution is busy"
  ),
  SCAN_EXECUTION_FAILED(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "SCAN_EXECUTION_FAILED",
      "Scan execution failed"
  ),
  RAW_RESULT_UPLOAD_FAILED(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "RAW_RESULT_UPLOAD_FAILED",
      "Raw result upload failed"
  ),
  ANALYSIS_QUEUE_PUBLISH_FAILED(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "ANALYSIS_QUEUE_PUBLISH_FAILED",
      "Analysis queue publish failed"
  ),
  INVALID_PAYLOAD_HASH(HttpStatus.BAD_REQUEST, "INVALID_PAYLOAD_HASH", "payloadHash format is invalid"),
  RAW_RESULT_NOT_FOUND(HttpStatus.NOT_FOUND, "RAW_RESULT_NOT_FOUND", "Raw result object not found"),
  ANALYSIS_RESULT_NOT_FOUND(
      HttpStatus.NOT_FOUND,
      "ANALYSIS_RESULT_NOT_FOUND",
      "Analysis result object not found"
  ),
  AGENT_NOT_FOUND(
      HttpStatus.NOT_FOUND,
      "AGENT_NOT_FOUND",
      "Local Agent is not registered for this project"
  ),
  AGENT_OFFLINE(
      HttpStatus.CONFLICT,
      "AGENT_OFFLINE",
      "Local Agent is not online"
  ),
  PATCH_PAYLOAD_NOT_FOUND(
      HttpStatus.CONFLICT,
      "PATCH_PAYLOAD_NOT_FOUND",
      "Patch payload is not available for this finding"
  ),
  PATCH_APPROVAL_NOT_ALLOWED(
      HttpStatus.CONFLICT,
      "PATCH_APPROVAL_NOT_ALLOWED",
      "Patch approval is not allowed for current finding state"
  ),
  UPLOAD_PATCH_NOT_ALLOWED(
      HttpStatus.CONFLICT,
      "UPLOAD_PATCH_NOT_ALLOWED",
      "Patch approval is not supported for upload scans"
  ),
  SCAN_STATUS_CONFLICT(
      HttpStatus.CONFLICT,
      "SCAN_STATUS_CONFLICT",
      "Operation is not allowed for current scan status"
  ),
  TASK_STATUS_CONFLICT(
      HttpStatus.CONFLICT,
      "TASK_STATUS_CONFLICT",
      "Operation is not allowed for current task status"
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
