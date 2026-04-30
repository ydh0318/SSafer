package com.ssafer.global.security;

public record AgentPrincipal(Long agentId) {

  public static AgentPrincipal of(Long agentId) {
    return new AgentPrincipal(agentId);
  }
}

