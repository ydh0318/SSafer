package com.ssafer.global.security;

import com.ssafer.global.api.ApiErrorResponse;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.logging.ApiLogContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
// 인증이 없거나 토큰이 유효하지 않은 경우(401)를 프로젝트 공통 에러 포맷으로 응답한다.
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

  private final ObjectMapper objectMapper;

  public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  public void commence(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationException authException
  ) throws IOException, ServletException {
    ErrorCode code = ErrorCode.UNAUTHORIZED;
    String reason = authException.getMessage();
    if (reason == null
        || reason.isBlank()
        || "Full authentication is required to access this resource".equals(reason)) {
      reason = "보호된 API인데 인증 정보가 없거나 토큰 검증에 실패했습니다.";
    }
    ApiLogContext.markFailure(
        request,
        "스프링 시큐리티 인증 진입점",
        reason
    );
    response.setStatus(code.status().value());
    // Security 예외 응답도 일반 API 에러와 같은 JSON/UTF-8 포맷으로 고정한다.
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(code.code(), code.message()));
  }
}
