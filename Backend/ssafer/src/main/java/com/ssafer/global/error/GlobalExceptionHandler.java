package com.ssafer.global.error;

import com.ssafer.global.api.ApiErrorResponse;
import com.ssafer.global.logging.ApiLogContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(RejoinRequiredException.class)
  public ResponseEntity<ApiErrorResponse> handleRejoinRequiredException(
      HttpServletRequest request,
      RejoinRequiredException ex
  ) {
    ErrorCode code = ex.getErrorCode();
    ApiLogContext.markFailure(
        request,
        "Business validation",
        code.code() + ": " + describeErrorCode(code)
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("rejoinToken", ex.getRejoinToken())));
  }

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiErrorResponse> handleBusinessException(
      HttpServletRequest request,
      BusinessException ex
  ) {
    ErrorCode code = ex.getErrorCode();
    ApiLogContext.markFailure(
        request,
        "Business validation",
        code.code() + ": " + describeErrorCode(code)
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
      HttpServletRequest request,
      MethodArgumentNotValidException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = extractFieldErrors(ex.getBindingResult().getFieldErrors());
    ApiLogContext.markFailure(
        request,
        "Request body validation",
        "Validation failed: " + fieldErrors
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(BindException.class)
  public ResponseEntity<ApiErrorResponse> handleBindException(
      HttpServletRequest request,
      BindException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = extractFieldErrors(ex.getBindingResult().getFieldErrors());
    ApiLogContext.markFailure(
        request,
        "Request parameter binding",
        "Binding failed: " + fieldErrors
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(HandlerMethodValidationException.class)
  public ResponseEntity<ApiErrorResponse> handleHandlerMethodValidation(
      HttpServletRequest request,
      HandlerMethodValidationException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    for (var validationResult : ex.getParameterValidationResults()) {
      if (validationResult instanceof ParameterErrors parameterErrors) {
        for (FieldError fieldError : parameterErrors.getFieldErrors()) {
          fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        continue;
      }

      String parameterName = validationResult.getMethodParameter().getParameterName();
      if (parameterName == null) {
        parameterName = "request";
      }

      for (MessageSourceResolvable resolvable : validationResult.getResolvableErrors()) {
        fieldErrors.putIfAbsent(parameterName, resolvable.getDefaultMessage());
      }
    }

    ApiLogContext.markFailure(
        request,
        "Method parameter validation",
        "Validation failed: " + fieldErrors
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiErrorResponse> handleMissingServletRequestParameter(
      HttpServletRequest request,
      MissingServletRequestParameterException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = Map.of(ex.getParameterName(), "Required request parameter is missing");
    ApiLogContext.markFailure(
        request,
        "Required request parameter",
        "Missing parameter: " + ex.getParameterName()
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiErrorResponse> handleHttpMessageNotReadable(
      HttpServletRequest request,
      HttpMessageNotReadableException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Throwable cause = ex.getMostSpecificCause();
    String reason = cause != null && cause.getMessage() != null
        ? cause.getMessage()
        : ex.getMessage();
    ApiLogContext.markFailure(
        request,
        "Request body parsing",
        "Request body could not be parsed: " + reason
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatusException(
      HttpServletRequest request,
      ResponseStatusException ex
  ) {
    String message = ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString();
    ApiLogContext.markFailure(
        request,
        "Controller status exception",
        message
    );
    return ResponseEntity.status(ex.getStatusCode())
        .body(ApiErrorResponse.of(ex.getStatusCode().toString(), message));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleException(
      HttpServletRequest request,
      Exception ex
  ) {
    ErrorCode code = ErrorCode.INTERNAL_SERVER_ERROR;
    ApiLogContext.markFailure(
        request,
        "Unhandled exception",
        ex.getClass().getSimpleName() + ": " + ex.getMessage()
    );
    log.error(
        "[Unhandled exception] requestId={} error={}",
        ApiLogContext.getRequestId(request),
        ex.getMessage(),
        ex
    );
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  private Map<String, String> extractFieldErrors(Iterable<FieldError> fieldErrors) {
    Map<String, String> values = new LinkedHashMap<>();
    for (FieldError fieldError : fieldErrors) {
      values.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
    }
    return values;
  }

  private String describeErrorCode(ErrorCode code) {
    return switch (code) {
      case UNAUTHORIZED -> "Authentication is required or token is invalid.";
      case FORBIDDEN -> "You do not have permission to access this resource.";
      case NOT_FOUND -> "Requested resource was not found.";
      case DUPLICATE_EMAIL -> "Email is already registered.";
      case DUPLICATE_DISPLAY_NAME -> "Nickname is already in use.";
      case SOCIAL_ACCOUNT_ALREADY_LINKED -> "Social account is already linked.";
      case SOCIAL_ACCOUNT_NOT_LINKED -> "Social account is not linked.";
      case SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED -> "Cannot disconnect the last available sign-in method.";
      case REJOIN_REQUIRED -> "Rejoin confirmation is required for the withdrawn account.";
      case OAUTH_AUTHENTICATION_FAILED -> "OAuth authentication failed.";
      case OAUTH_PROVIDER_UNAVAILABLE -> "OAuth provider is unavailable.";
      case INVALID_CREDENTIALS -> "Email or password is incorrect.";
      case EMAIL_VERIFICATION_REQUIRED -> "Verified email is required before registration.";
      case EMAIL_VERIFICATION_CODE_INVALID -> "Email verification code is invalid or expired.";
      case PASSWORD_RESET_CODE_INVALID -> "Password reset verification code is invalid or expired.";
      case PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED -> "Password reset verification attempts exceeded.";
      case PASSWORD_RESET_TOKEN_INVALID -> "Password reset token is invalid or expired.";
      case PASSWORD_SETUP_NOT_ALLOWED -> "Password setup is not allowed for the current account state.";
      case EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT -> "Email verification requests are too frequent.";
      case EMAIL_DELIVERY_FAILED -> "Email delivery failed.";
      case INVALID_PARAMETER -> "Request parameter format is invalid.";
      case FILE_COUNT_EXCEEDED -> "Upload file count exceeded.";
      case UNSUPPORTED_FILE_TYPE -> "Unsupported upload file type.";
      case PAYLOAD_TOO_LARGE -> "Payload too large.";
      case SCAN_EXECUTION_BUSY -> "Scan execution is busy.";
      case SCAN_EXECUTION_FAILED -> "Scan execution failed.";
      case RAW_RESULT_UPLOAD_FAILED -> "Raw result upload failed.";
      case ANALYSIS_QUEUE_PUBLISH_FAILED -> "Analysis queue publish failed.";
      case INVALID_PAYLOAD_HASH -> "payloadHash format is invalid.";
      case RAW_RESULT_NOT_FOUND -> "Raw result object was not found.";
      case ANALYSIS_RESULT_NOT_FOUND -> "Analysis result object was not found.";
      case AGENT_NOT_FOUND -> "Local Agent is not registered for this project.";
      case AGENT_OFFLINE -> "Local Agent is not online.";
      case PATCH_PAYLOAD_NOT_FOUND -> "Patch payload is not available for this finding.";
      case PATCH_APPROVAL_NOT_ALLOWED -> "Patch approval is not allowed for the current finding state.";
      case UPLOAD_PATCH_NOT_ALLOWED -> "Patch approval is not supported for upload scans.";
      case SCAN_STATUS_CONFLICT -> "Operation is not allowed for the current scan status.";
      case TASK_STATUS_CONFLICT -> "Operation is not allowed for the current task status.";
      case DUPLICATE_RAW_RESULT_UPLOAD -> "Raw result upload report was already submitted.";
      case INTERNAL_SERVER_ERROR -> "Internal server error.";
    };
  }
}
