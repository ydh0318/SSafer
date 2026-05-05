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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
// 인증은 되었지만 리소스 접근 권한이 없는 경우(403)를 공통 에러 포맷으로 응답한다.
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

  private final ObjectMapper objectMapper;

  public ApiAccessDeniedHandler(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  public void handle(
      HttpServletRequest request,
      HttpServletResponse response,
      AccessDeniedException accessDeniedException
  ) throws IOException, ServletException {
    ErrorCode code = ErrorCode.FORBIDDEN;
    String reason = accessDeniedException.getMessage();
    if (reason == null || reason.isBlank() || "Access Denied".equalsIgnoreCase(reason)) {
      reason = "인증은 되었지만 이 API에 접근할 권한이 없습니다.";
    }
    ApiLogContext.markFailure(
        request,
        "스프링 시큐리티 권한 검사",
        reason
    );
    response.setStatus(code.status().value());
    // 권한 거부 응답도 일반 API 에러와 같은 JSON/UTF-8 포맷으로 고정한다.
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(code.code(), code.message()));
  }
}
