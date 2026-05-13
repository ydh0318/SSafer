package com.ssafer.scan.infrastructure.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ssafer.scan.application.service.UploadFileScanResult;
import com.ssafer.scan.application.service.UploadScanFinding;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.RestClient;

class HttpEngineUploadFileScannerTest {

  private HttpServer server;

  @TempDir
  Path tempDir;

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    server.start();
  }

  @AfterEach
  void tearDown() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void scanAllPostsMultipartFilesAndReturnsFindings() throws Exception {
    AtomicReference<String> methodRef = new AtomicReference<>();
    AtomicReference<String> pathRef = new AtomicReference<>();
    AtomicReference<String> tokenRef = new AtomicReference<>();
    AtomicReference<String> bodyRef = new AtomicReference<>();

    server.createContext("/api/v1/scan/upload", exchange -> {
      methodRef.set(exchange.getRequestMethod());
      pathRef.set(exchange.getRequestURI().getPath());
      tokenRef.set(exchange.getRequestHeaders().getFirst("X-Internal-Token"));
      bodyRef.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      writeJson(exchange, 200, """
          {
            "findings": [
              {
                "id": "FND-0001",
                "ruleId": "ENV_PLAIN_SECRET",
                "source": "custom-rule",
                "severity": "HIGH",
                "file": ".env",
                "line": 3,
                "title": "Plain secret",
                "maskedEvidence": "DB_PASSWORD=***MASKED***",
                "filePath": ".env",
                "targetFiles": [".env"],
                "patchContext": null
              }
            ],
            "warnings": ["compose file skipped"],
            "sourceFileHashes": {".env": "sha256:abc123"},
            "targets": {"envFiles": [".env"], "dockerfiles": [], "composeFiles": []},
            "summary": {"customRuleFindings": 1, "trivyFindings": 0, "totalFindings": 1, "warnings": 1}
          }
          """);
    });
    Path uploadFile = tempDir.resolve(".env");
    Files.writeString(uploadFile, "DB_PASSWORD=plain", StandardCharsets.UTF_8);

    HttpEngineUploadFileScanner scanner = scanner("test-token");

    UploadFileScanResult result = scanner.scanAll(List.of(uploadFile));

    assertThat(methodRef.get()).isEqualTo("POST");
    assertThat(pathRef.get()).isEqualTo("/api/v1/scan/upload");
    assertThat(tokenRef.get()).isEqualTo("test-token");
    assertThat(bodyRef.get()).contains("name=\"files\"");
    assertThat(bodyRef.get()).contains("DB_PASSWORD=plain");
    assertThat(result.findings()).containsExactly(new UploadScanFinding(
        "FND-0001",
        "ENV_PLAIN_SECRET",
        "custom-rule",
        "HIGH",
        ".env",
        3,
        "Plain secret",
        "DB_PASSWORD=***MASKED***",
        ".env",
        List.of(".env"),
        null
    ));
    assertThat(result.warnings()).containsExactly("compose file skipped");
    assertThat(result.sourceFileHashes()).containsEntry(".env", "sha256:abc123");
    assertThat(result.targets()).containsKey("envFiles");
    assertThat(result.summary()).containsEntry("totalFindings", 1);
  }

  @Test
  void scanAllThrowsWhenEngineReturnsError() throws Exception {
    server.createContext("/api/v1/scan/upload", exchange -> writeJson(exchange, 500, "{\"detail\":\"boom\"}"));
    Path uploadFile = tempDir.resolve("Dockerfile");
    Files.writeString(uploadFile, "FROM alpine", StandardCharsets.UTF_8);

    HttpEngineUploadFileScanner scanner = scanner("test-token");

    assertThatThrownBy(() -> scanner.scanAll(List.of(uploadFile)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Upload scan engine returned error");
  }

  private HttpEngineUploadFileScanner scanner(String internalToken) {
    RestClient restClient = RestClient.builder()
        .baseUrl("http://localhost:" + server.getAddress().getPort())
        .build();
    return new HttpEngineUploadFileScanner(restClient, internalToken);
  }

  private void writeJson(HttpExchange exchange, int statusCode, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(statusCode, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }
}
