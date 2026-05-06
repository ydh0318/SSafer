package com.ssafer.auth.infrastructure.oauth.github;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "oauth.github")
public class GithubOAuthProperties {

  private String clientId;
  private String clientSecret;
  private String tokenUri = "https://github.com/login/oauth/access_token";
  private String userInfoUri = "https://api.github.com/user";
  private String userEmailsUri = "https://api.github.com/user/emails";

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public String getClientSecret() {
    return clientSecret;
  }

  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }

  public String getTokenUri() {
    return tokenUri;
  }

  public void setTokenUri(String tokenUri) {
    this.tokenUri = tokenUri;
  }

  public String getUserInfoUri() {
    return userInfoUri;
  }

  public void setUserInfoUri(String userInfoUri) {
    this.userInfoUri = userInfoUri;
  }

  public String getUserEmailsUri() {
    return userEmailsUri;
  }

  public void setUserEmailsUri(String userEmailsUri) {
    this.userEmailsUri = userEmailsUri;
  }
}
