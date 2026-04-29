package com.ssafer.global.security;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
/**
 * 모든 요청에서 Bearer 토큰을 읽어 SecurityContext에 인증 주체를 저장한다.
 * 실제 권한 판단은 이후 서비스 계층(ProjectAuthorizationService)에서 수행한다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtAuthenticationTokenParser tokenParser;

  public JwtAuthenticationFilter(JwtAuthenticationTokenParser tokenParser) {
    this.tokenParser = tokenParser;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
    // Bearer 헤더가 없으면 익명 요청으로 통과시키고, 엔드포인트 보안 규칙에서 최종 판단한다.
    if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = authorization.substring(BEARER_PREFIX.length()).trim();
    if (token.isBlank()) {
      SecurityContextHolder.clearContext();
      throw new BadCredentialsException(ErrorCode.UNAUTHORIZED.message());
    }

    try {
      AuthenticatedActor actor = tokenParser.parse(token);
      // Spring Security 권한 체계와 맞추기 위해 ROLE_MEMBER / ROLE_GUEST를 부여한다.
      SecurityContextHolder.getContext().setAuthentication(createAuthentication(actor));
    } catch (BusinessException ex) {
      SecurityContextHolder.clearContext();
      throw new BadCredentialsException(ex.getMessage(), ex);
    }

    filterChain.doFilter(request, response);
  }

  private UsernamePasswordAuthenticationToken createAuthentication(AuthenticatedActor actor) {
    List<SimpleGrantedAuthority> authorities = List.of(
        new SimpleGrantedAuthority(actor.isGuest() ? "ROLE_GUEST" : "ROLE_MEMBER")
    );
    return new UsernamePasswordAuthenticationToken(actor, null, authorities);
  }
}
