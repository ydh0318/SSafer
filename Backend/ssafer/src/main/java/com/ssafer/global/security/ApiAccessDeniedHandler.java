package com.ssafer.global.security;

import com.ssafer.global.api.ApiErrorResponse;
import com.ssafer.global.error.ErrorCode;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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
    response.setStatus(code.status().value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(code.code(), code.message()));
  }
}
