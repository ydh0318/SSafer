package com.ssafer.global.error;

import com.ssafer.global.api.ApiErrorResponse;
import java.util.LinkedHashMap;
import java.util.Map;
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
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException ex) {
    ErrorCode code = ex.getErrorCode();
    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    // 요청 본문 검증 실패 시 어떤 필드가 왜 잘못됐는지 data에 함께 내려준다.
    for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
      fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
    }

    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(BindException.class)
  public ResponseEntity<ApiErrorResponse> handleBindException(BindException ex) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    // 쿼리 파라미터를 DTO로 바인딩하는 과정에서 발생한 검증 오류를 필드 단위로 내려준다.
    for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
      fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
    }

    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(HandlerMethodValidationException.class)
  public ResponseEntity<ApiErrorResponse> handleHandlerMethodValidation(HandlerMethodValidationException ex) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    // 쿼리 파라미터 등 메서드 인자 검증 실패도 같은 응답 형식으로 맞춘다.
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

    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiErrorResponse> handleMissingServletRequestParameter(
      MissingServletRequestParameterException ex
  ) {
    ErrorCode code = ErrorCode.INVALID_PARAMETER;
    Map<String, String> fieldErrors = Map.of(ex.getParameterName(), "필수 요청 파라미터입니다.");

    return ResponseEntity.status(code.status())
        .body(ApiErrorResponse.of(code.code(), code.message(), Map.of("fieldErrors", fieldErrors)));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiErrorResponse> handleHttpMessageNotReadable() {
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
