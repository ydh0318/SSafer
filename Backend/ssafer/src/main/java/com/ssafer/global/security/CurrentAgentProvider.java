package com.ssafer.global.security;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentAgentProvider {

  public AgentPrincipal getCurrentAgent() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }

    Object principal = authentication.getPrincipal();
    if (!(principal instanceof AgentPrincipal agentPrincipal)) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }
    return agentPrincipal;
  }
}

