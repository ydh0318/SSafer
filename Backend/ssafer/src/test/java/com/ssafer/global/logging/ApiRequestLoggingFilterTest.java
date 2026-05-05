package com.ssafer.global.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

class ApiRequestLoggingFilterTest {

  private ApiRequestLoggingFilter filter;
  private Logger logger;
  private ListAppender<ILoggingEvent> appender;

  @BeforeEach
  void setUp() {
    filter = new ApiRequestLoggingFilter(new ApiLogFormatter(new ObjectMapper()));
    logger = (Logger) LoggerFactory.getLogger(ApiRequestLoggingFilter.class);
    appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void tearDown() {
    logger.detachAppender(appender);
  }

  @Test
  void logsRequestSuccessWithMaskedSensitiveValues() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setCharacterEncoding(StandardCharsets.UTF_8.name());
    request.setContent("""
        {
          "email": "user@ssafer.co.kr",
          "password": "password123!"
        }
        """.getBytes(StandardCharsets.UTF_8));
    request.setParameter("mode", "normal");
    request.addHeader("User-Agent", "JUnit");

    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = (wrappedRequest, wrappedResponse) -> {
      wrappedRequest.getInputStream().readAllBytes();
      HttpServletResponse httpResponse = (HttpServletResponse) wrappedResponse;
      httpResponse.setStatus(200);
      httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
      httpResponse.getWriter().write("""
          {"message":"ok"}
          """);
    };

    filter.doFilter(request, response, chain);

    assertThat(response.getHeader("X-Request-Id")).isNotBlank();

    String mergedLogs = appender.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .reduce("", (left, right) -> left + System.lineSeparator() + right);

    assertThat(appender.list).hasSize(1);
    assertThat(mergedLogs).contains("[API 성공]");
    assertThat(mergedLogs).contains("API=POST /api/v1/auth/login");
    assertThat(mergedLogs).contains("상태=200");
    assertThat(mergedLogs).doesNotContain("password123!");
    assertThat(mergedLogs).doesNotContain("\"password\":");
  }

  @Test
  void logsRequestFailureWithStageAndReason() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/internal/scans/1/raw-results");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setCharacterEncoding(StandardCharsets.UTF_8.name());
    request.setContent("""
        {
          "scanId": 1
        }
        """.getBytes(StandardCharsets.UTF_8));

    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = (wrappedRequest, wrappedResponse) -> {
      wrappedRequest.getInputStream().readAllBytes();
      ApiLogContext.markFailure(
          (HttpServletRequest) wrappedRequest,
          "워커 시크릿 인증 필터",
          "X-Worker-Secret 헤더가 없거나 비어 있습니다."
      );
      HttpServletResponse httpResponse = (HttpServletResponse) wrappedResponse;
      httpResponse.setStatus(401);
      httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);
      httpResponse.getWriter().write("""
          {"code":"UNAUTHORIZED","message":"Authentication is required or token is invalid"}
          """);
    };

    filter.doFilter(request, response, chain);

    String mergedLogs = appender.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .reduce("", (left, right) -> left + System.lineSeparator() + right);

    assertThat(mergedLogs).contains("[API 요청 실패]");
    assertThat(mergedLogs).contains("실패 지점: 워커 시크릿 인증 필터");
    assertThat(mergedLogs).contains("실패 사유: X-Worker-Secret 헤더가 없거나 비어 있습니다.");
    assertThat(mergedLogs).contains("응답 상태: 401");
  }
}
