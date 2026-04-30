package com.ssafer.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AgentTokenAuthenticationFilter extends OncePerRequestFilter {

  private static final String BEARER_PREFIX = "Bearer ";

  private final Map<Long, byte[]> tokenBytesByAgentId;

  public AgentTokenAuthenticationFilter(
      @Value("${AGENT_AUTH_TOKENS:}") String agentAuthTokens
  ) {
    this.tokenBytesByAgentId = parseTokens(agentAuthTokens);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String authorization = request.getHeader("Authorization");
    if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
      SecurityContextHolder.clearContext();
      filterChain.doFilter(request, response);
      return;
    }

    String token = authorization.substring(BEARER_PREFIX.length()).trim();
    if (token.isBlank()) {
      SecurityContextHolder.clearContext();
      filterChain.doFilter(request, response);
      return;
    }

    Long matchedAgentId = findMatchedAgentId(token);
    if (matchedAgentId == null) {
      SecurityContextHolder.clearContext();
      filterChain.doFilter(request, response);
      return;
    }

    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
        AgentPrincipal.of(matchedAgentId),
        null,
        List.of(new SimpleGrantedAuthority("ROLE_AGENT"))
    );
    SecurityContextHolder.getContext().setAuthentication(authentication);
    filterChain.doFilter(request, response);
  }

  private Long findMatchedAgentId(String token) {
    byte[] tokenBytes = token.getBytes(StandardCharsets.UTF_8);
    for (Map.Entry<Long, byte[]> entry : tokenBytesByAgentId.entrySet()) {
      if (MessageDigest.isEqual(entry.getValue(), tokenBytes)) {
        return entry.getKey();
      }
    }
    return null;
  }

  private Map<Long, byte[]> parseTokens(String source) {
    Map<Long, byte[]> result = new HashMap<>();
    if (source == null || source.isBlank()) {
      return result;
    }

    String[] pairs = source.split(",");
    for (String pair : pairs) {
      String[] parts = pair.trim().split(":", 2);
      if (parts.length != 2) {
        continue;
      }
      try {
        Long agentId = Long.parseLong(parts[0].trim());
        String token = parts[1].trim();
        if (!token.isBlank()) {
          result.put(agentId, token.getBytes(StandardCharsets.UTF_8));
        }
      } catch (NumberFormatException ignored) {
        // ignore invalid token mapping entries
      }
    }
    return result;
  }
}

