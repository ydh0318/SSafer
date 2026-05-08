package com.ssafer.auth.infrastructure.oauth.google;

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

class GoogleOAuthRestClientTest {

  private HttpServer server;
  private GoogleOAuthRestClient client;
  private GoogleOAuthProperties properties;

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    server.start();

    properties = new GoogleOAuthProperties();
    properties.setClientId("google-client-id");
    properties.setClientSecret("google-client-secret");
    properties.setTokenUri("http://localhost:" + server.getAddress().getPort() + "/token");
    properties.setUserInfoUri("http://localhost:" + server.getAddress().getPort() + "/userinfo");
    client = new GoogleOAuthRestClient(properties);
  }

  @AfterEach
  void tearDown() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void exchangeAuthorizationCodeThrowsUnauthorizedWhenProviderReturnsFourHundred() {
    server.createContext("/token", jsonHandler(400, "{\"error\":\"invalid_grant\"}"));

    assertThatThrownBy(() -> client.exchangeAuthorizationCode("bad-code", "http://localhost/callback"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
  }

  @Test
  void fetchUserInfoThrowsBadGatewayWhenProviderReturnsServerError() {
    server.createContext("/userinfo", jsonHandler(503, "{\"error\":\"unavailable\"}"));

    assertThatThrownBy(() -> client.fetchUserInfo("access-token"))
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
