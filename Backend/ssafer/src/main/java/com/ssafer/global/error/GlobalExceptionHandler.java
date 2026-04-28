package com.ssafer.global.error;

import com.ssafer.global.api.ApiErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException ex) {
    ErrorCode code = ex.getErrorCode();
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  @ExceptionHandler({
      MethodArgumentNotValidException.class,
      HttpMessageNotReadableException.class
  })
  public ResponseEntity<ApiErrorResponse> handleInvalidParameter() {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatusException(ResponseStatusException ex) {
    // 서비스에서 의도적으로 던진 400/404/409 등을 500으로 뭉개지 않고 그대로 응답한다.
    String message = ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString();
    return ResponseEntity.status(ex.getStatusCode())
        .body(ApiErrorResponse.of(ex.getStatusCode().toString(), message));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleException() {
    ErrorCode code = ErrorCode.INTERNAL_SERVER_ERROR;
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }
}
