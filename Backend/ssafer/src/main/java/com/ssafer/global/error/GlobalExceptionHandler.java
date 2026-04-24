package com.ssafer.global.error;

import com.ssafer.global.api.ApiErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleException() {
    ErrorCode code = ErrorCode.INTERNAL_SERVER_ERROR;
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }
}
