package com.ssafer.global.security;

import com.ssafer.global.logging.ApiLogContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AgentTokenAuthenticationFilter extends OncePerRequestFilter {

  private static final String BEARER_PREFIX = "Bearer ";

  private final AgentTokenRegistry agentTokenRegistry;

  public AgentTokenAuthenticationFilter(AgentTokenRegistry agentTokenRegistry) {
    this.agentTokenRegistry = agentTokenRegistry;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    // /api/v1/internal/agents/** 경로는 Bearer 토큰이 필수다.
    String authorization = request.getHeader("Authorization");
    if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
      SecurityContextHolder.clearContext();
      ApiLogContext.markFailure(
          request,
          "에이전트 토큰 인증 필터",
          "Authorization Bearer 토큰이 없습니다."
      );
      filterChain.doFilter(request, response);
      return;
    }

    String token = authorization.substring(BEARER_PREFIX.length()).trim();
    if (token.isBlank()) {
      SecurityContextHolder.clearContext();
      ApiLogContext.markFailure(
          request,
          "에이전트 토큰 인증 필터",
          "Authorization Bearer 토큰 값이 비어 있습니다."
      );
      filterChain.doFilter(request, response);
      return;
    }

    Long matchedAgentId = agentTokenRegistry.findMatchedAgentId(token);
    if (matchedAgentId == null) {
      SecurityContextHolder.clearContext();
      ApiLogContext.markFailure(
          request,
          "에이전트 토큰 인증 필터",
          "에이전트 토큰이 등록된 값과 일치하지 않습니다."
      );
      filterChain.doFilter(request, response);
      return;
    }

    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
        // 토큰에서 식별한 agentId를 principal로 보관한다.
        AgentPrincipal.of(matchedAgentId),
        null,
        List.of(new SimpleGrantedAuthority("ROLE_AGENT"))
    );
    SecurityContextHolder.getContext().setAuthentication(authentication);
    filterChain.doFilter(request, response);
  }
}
