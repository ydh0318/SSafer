package com.ssafer.scan.infrastructure.engine;

import com.ssafer.scan.application.service.UploadFileScanner;
import com.ssafer.scan.application.service.UploadFileScanResult;
import com.ssafer.scan.application.service.UploadScanFinding;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
@Slf4j
@ConditionalOnProperty(name = "app.scan.engine.enabled", havingValue = "true", matchIfMissing = true)
public class HttpEngineUploadFileScanner implements UploadFileScanner {

  private static final String UPLOAD_SCAN_PATH = "/api/v1/scan/upload";
  private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";
  private static final String FILES_FIELD_NAME = "files";

  private final RestClient restClient;
  private final String internalToken;

  @Autowired
  public HttpEngineUploadFileScanner(Environment environment) {
    // application property와 환경변수를 모두 허용해 로컬 실행과 Infra compose 실행을 함께 지원한다.
    String engineUrl = firstNonBlank(
        environment.getProperty("app.scan.engine.url"),
        environment.getProperty("APP_SCAN_ENGINE_URL"),
        "http://engine:8100"
    );
    String internalToken = firstNonBlank(
        environment.getProperty("internal.token"),
        environment.getProperty("INTERNAL_TOKEN"),
        ""
    );
    long timeoutSeconds = Long.parseLong(firstNonBlank(
        environment.getProperty("app.scan.engine.timeout-seconds"),
        environment.getProperty("APP_SCAN_UPLOAD_SCAN_TIMEOUT_SECONDS"),
        "120"
    ));

    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    Duration timeout = Duration.ofSeconds(timeoutSeconds);
    requestFactory.setConnectTimeout(timeout);
    requestFactory.setReadTimeout(timeout);

    this.restClient = RestClient.builder()
        .baseUrl(engineUrl)
        .requestFactory(requestFactory)
        .build();
    this.internalToken = internalToken;
  }

  HttpEngineUploadFileScanner(RestClient restClient, String internalToken) {
    this.restClient = restClient;
    this.internalToken = internalToken;
  }

  @Override
  public UploadFileScanResult scanAll(List<Path> targetFiles) {
    MultiValueMap<String, Object> multipartBody = new LinkedMultiValueMap<>();
    for (Path targetFile : targetFiles) {
      // engine API 명세의 multipart form field 이름은 files이다.
      multipartBody.add(FILES_FIELD_NAME, new FileSystemResource(targetFile));
    }

    try {
      // Spring은 스캔 실행만 engine에 위임하고, 이후 JSON/S3/MQ 처리는 기존 흐름을 유지한다.
      EngineUploadScanResponse response = restClient.post()
          .uri(UPLOAD_SCAN_PATH)
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .header(INTERNAL_TOKEN_HEADER, internalToken)
          .body(multipartBody)
          .retrieve()
          .body(EngineUploadScanResponse.class);

      EngineUploadScanResponse safeResponse = Objects.requireNonNull(response);
      logWarnings(safeResponse.warnings());
      return new UploadFileScanResult(
          safeResponse.findings(),
          safeResponse.warnings(),
          safeResponse.sourceFileHashes(),
          safeResponse.targets(),
          safeResponse.summary()
      );
    } catch (RestClientResponseException ex) {
      log.error(
          "Upload scan engine returned error. status={}, response={}",
          ex.getStatusCode(),
          abbreviate(ex.getResponseBodyAsString())
      );
      throw new IllegalStateException("Upload scan engine returned error: " + ex.getStatusCode(), ex);
    } catch (RestClientException ex) {
      // 연결 실패와 timeout은 WebUploadScanProcessorImpl에서 SCAN_EXECUTION_FAILED로 전이된다.
      log.error("Upload scan engine request failed", ex);
      throw new IllegalStateException("Upload scan engine request failed", ex);
    }
  }

  private void logWarnings(List<String> warnings) {
    if (warnings == null || warnings.isEmpty()) {
      return;
    }
    for (String warning : warnings) {
      log.warn("Upload scan engine warning: {}", warning);
    }
  }

  private String abbreviate(String text) {
    if (text == null || text.isBlank()) {
      return "";
    }
    String normalized = text.replaceAll("\\s+", " ").trim();
    if (normalized.length() <= 300) {
      return normalized;
    }
    return normalized.substring(0, 300);
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private record EngineUploadScanResponse(
      List<UploadScanFinding> findings,
      List<String> warnings,
      Map<String, String> sourceFileHashes,
      Map<String, Object> targets,
      Map<String, Object> summary
  ) {
  }
}
