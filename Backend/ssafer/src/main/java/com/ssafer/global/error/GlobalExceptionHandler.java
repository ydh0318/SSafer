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

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiErrorResponse> handleBusinessException(
      HttpServletRequest request,
      BusinessException ex
  ) {
    ErrorCode code = ex.getErrorCode();
    ApiLogContext.markFailure(
        request,
        "비즈니스 규칙 검증",
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
        "요청 본문 검증",
        "입력값 검증 실패: " + fieldErrors
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
        "요청 파라미터 바인딩",
        "쿼리 또는 폼 파라미터 바인딩 실패: " + fieldErrors
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
        "메서드 파라미터 검증",
        "메서드 파라미터 검증 실패: " + fieldErrors
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
    Map<String, String> fieldErrors = Map.of(ex.getParameterName(), "필수 요청 파라미터입니다.");
    ApiLogContext.markFailure(
        request,
        "필수 파라미터 검증",
        "필수 요청 파라미터가 없습니다: " + ex.getParameterName()
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
        "요청 본문 파싱",
        "요청 본문을 해석할 수 없습니다: " + reason
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
        "컨트롤러 응답 상태 예외",
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
        "서버 내부 예외",
        ex.getClass().getSimpleName() + ": " + ex.getMessage()
    );
    log.error(
        "[서버 내부 예외] 요청ID={} 예외={}",
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
    // 운영 로그는 비개발자도 바로 읽을 수 있게 한글 설명을 따로 붙인다.
    return switch (code) {
      case UNAUTHORIZED -> "인증 정보가 없거나 토큰이 유효하지 않습니다.";
      case FORBIDDEN -> "요청한 자원에 접근할 권한이 없습니다.";
      case NOT_FOUND -> "요청한 데이터를 찾을 수 없습니다.";
      case DUPLICATE_EMAIL -> "이미 가입된 이메일입니다.";
      case DUPLICATE_DISPLAY_NAME -> "이미 사용 중인 닉네임입니다.";
      case INVALID_CREDENTIALS -> "이메일 또는 비밀번호가 올바르지 않습니다.";
      case EMAIL_VERIFICATION_REQUIRED -> "회원가입 전에 이메일 인증이 필요합니다.";
      case EMAIL_VERIFICATION_CODE_INVALID -> "이메일 인증 코드가 올바르지 않거나 만료되었습니다.";
      case PASSWORD_RESET_CODE_INVALID -> "비밀번호 재설정 인증 코드가 올바르지 않거나 만료되었습니다.";
      case PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED -> "비밀번호 재설정 인증 코드 시도 가능 횟수를 초과했습니다.";
      case PASSWORD_RESET_TOKEN_INVALID -> "비밀번호 재설정 토큰이 올바르지 않거나 만료되었습니다.";
      case EMAIL_VERIFICATION_REQUEST_TOO_FREQUENT -> "이메일 인증 코드 요청이 너무 자주 발생했습니다.";
      case EMAIL_DELIVERY_FAILED -> "이메일 발송에 실패했습니다.";
      case INVALID_PARAMETER -> "요청 파라미터 형식이 올바르지 않습니다.";
      case INVALID_PAYLOAD_HASH -> "payloadHash 형식이 올바르지 않습니다.";
      case RAW_RESULT_NOT_FOUND -> "원본 스캔 결과 파일을 찾을 수 없습니다.";
      case SCAN_STATUS_CONFLICT -> "현재 스캔 상태에서는 원본 결과 업로드 보고를 처리할 수 없습니다.";
      case DUPLICATE_RAW_RESULT_UPLOAD -> "원본 결과 업로드 보고가 이미 접수되었습니다.";
      case INTERNAL_SERVER_ERROR -> "서버 내부 오류가 발생했습니다.";
    };
  }
}
