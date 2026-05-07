package com.ssafer.auth.infrastructure.oauth.github;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GithubOAuthRestClientTest {

  private HttpServer server;
  private GithubOAuthRestClient client;

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    server.start();

    GithubOAuthProperties properties = new GithubOAuthProperties();
    properties.setClientId("github-client-id");
    properties.setClientSecret("github-client-secret");
    properties.setTokenUri("http://localhost:" + server.getAddress().getPort() + "/token");
    properties.setUserInfoUri("http://localhost:" + server.getAddress().getPort() + "/user");
    properties.setUserEmailsUri("http://localhost:" + server.getAddress().getPort() + "/emails");
    client = new GithubOAuthRestClient(properties);
  }

  @AfterEach
  void tearDown() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void exchangeAuthorizationCodeThrowsUnauthorizedWhenProviderReturnsFourHundredOne() {
    server.createContext("/token", jsonHandler(401, "{\"error\":\"bad_verification_code\"}"));

    assertThatThrownBy(() -> client.exchangeAuthorizationCode("bad-code", "http://localhost/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
  }

  @Test
  void fetchUserEmailsThrowsBadGatewayWhenProviderReturnsServerError() {
    server.createContext("/emails", jsonHandler(502, "{\"error\":\"upstream\"}"));

    assertThatThrownBy(() -> client.fetchUserEmails("access-token"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
  }

  private HttpHandler jsonHandler(int statusCode, String body) {
    return exchange -> writeResponse(exchange, statusCode, body);
  }

  private void writeResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(statusCode, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }
}
