package com.ssafer.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class WorkerSecretAuthenticationFilter extends OncePerRequestFilter {

  static final String WORKER_SECRET_HEADER = "X-Worker-Secret";

  private final byte[] workerApiSecretBytes;

  public WorkerSecretAuthenticationFilter(
      @Value("${WORKER_API_SECRET:}") String workerApiSecret
  ) {
    // 내부 콜백 보호가 목적이라 시크릿이 비어 있으면 애플리케이션을 바로 실패시킨다.
    if (workerApiSecret == null || workerApiSecret.isBlank()) {
      throw new IllegalStateException("WORKER_API_SECRET must not be blank");
    }
    this.workerApiSecretBytes = workerApiSecret.getBytes(StandardCharsets.UTF_8);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String workerSecret = request.getHeader(WORKER_SECRET_HEADER);
    if (workerSecret == null || workerSecret.isBlank()) {
      SecurityContextHolder.clearContext();
      // 인증을 세우지 않고 다음 단계로 넘기면 Security가 최종적으로 401 응답을 만든다.
      filterChain.doFilter(request, response);
      return;
    }

    if (!matches(workerSecret)) {
      SecurityContextHolder.clearContext();
      // 시크릿 불일치도 동일하게 미인증 요청으로 처리한다.
      filterChain.doFilter(request, response);
      return;
    }

    // 내부 API에서는 사용자 principal 대신 worker principal만 세팅한다.
    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
        "worker",
        null,
        List.of(new SimpleGrantedAuthority("ROLE_WORKER"))
    );
    SecurityContextHolder.getContext().setAuthentication(authentication);
    filterChain.doFilter(request, response);
  }

  private boolean matches(String workerSecret) {
    return MessageDigest.isEqual(
        workerApiSecretBytes,
        workerSecret.getBytes(StandardCharsets.UTF_8)
    );
  }
}
