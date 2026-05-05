package com.ssafer.global.security;

import com.ssafer.global.logging.ApiLogContext;
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
      ApiLogContext.markFailure(
          request,
          "워커 시크릿 인증 필터",
          "X-Worker-Secret 헤더가 없거나 비어 있습니다."
      );
      filterChain.doFilter(request, response);
      return;
    }

    if (!matches(workerSecret)) {
      SecurityContextHolder.clearContext();
      ApiLogContext.markFailure(
          request,
          "워커 시크릿 인증 필터",
          "X-Worker-Secret 값이 서버 설정과 일치하지 않습니다."
      );
      filterChain.doFilter(request, response);
      return;
    }

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
