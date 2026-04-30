package com.ssafer.agent.ws;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "agent.auth")
public class AgentAuthenticationProperties {

  private String token = "";

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }
}

