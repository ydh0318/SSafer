package com.ssafer.global.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component
public class ApiRequestLoggingFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(ApiRequestLoggingFilter.class);
  private static final String REQUEST_ID_HEADER = "X-Request-Id";

  private final ApiLogFormatter apiLogFormatter;

  public ApiRequestLoggingFilter(ApiLogFormatter apiLogFormatter) {
    this.apiLogFormatter = apiLogFormatter;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String requestId = UUID.randomUUID().toString().substring(0, 8);
    ApiLogContext.setRequestId(request, requestId);

    // 본문을 두 번 읽어도 되도록 감싸서 요청/응답 내용을 완료 시점에 함께 남긴다.
    ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request, 8_192);
    ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
    // 인프라/프론트가 서버 로그와 클라이언트 요청을 바로 대조할 수 있게 응답에도 실어준다.
    wrappedResponse.setHeader(REQUEST_ID_HEADER, requestId);

    long startedAt = System.currentTimeMillis();
    try {
      filterChain.doFilter(wrappedRequest, wrappedResponse);
    } catch (Exception ex) {
      ApiLogContext.markFailure(
          wrappedRequest,
          "서블릿 필터 체인",
          ex.getClass().getSimpleName() + ": " + ex.getMessage()
      );
      throw ex;
    } finally {
      long elapsedMillis = System.currentTimeMillis() - startedAt;
      logCompletion(wrappedRequest, wrappedResponse, requestId, elapsedMillis);
      wrappedResponse.copyBodyToResponse();
    }
  }

  private void logCompletion(
      ContentCachingRequestWrapper request,
      ContentCachingResponseWrapper response,
      String requestId,
      long elapsedMillis
  ) {
    int status = response.getStatus();
    if (status == 0) {
      status = HttpStatus.INTERNAL_SERVER_ERROR.value();
    }

    if (status >= 400) {
      log.warn(buildFailureMessage(request, response, requestId, elapsedMillis, status));
      return;
    }

    log.info(buildSuccessMessage(request, response, requestId, elapsedMillis, status));
  }

  private String buildSuccessMessage(
      ContentCachingRequestWrapper request,
      ContentCachingResponseWrapper response,
      String requestId,
      long elapsedMillis,
      int status
  ) {
    return String.format(
        "[API 성공] 요청ID=%s API=%s 핸들러=%s 호출자=%s 상태=%d 시간(ms)=%d IP=%s",
        requestId,
        apiLogFormatter.describeApi(request),
        apiLogFormatter.describeHandler(request),
        apiLogFormatter.describeActor(),
        status,
        elapsedMillis,
        apiLogFormatter.describeClientIp(request)
    );
  }

  private String buildFailureMessage(
      ContentCachingRequestWrapper request,
      ContentCachingResponseWrapper response,
      String requestId,
      long elapsedMillis,
      int status
  ) {
    String responseBody = apiLogFormatter.summarizeResponseBody(response);
    List<String> lines = new ArrayList<>();
    lines.add("[API 요청 실패]");
    lines.add("요청 ID: " + requestId);
    lines.add("API: " + apiLogFormatter.describeApi(request));
    lines.add("핸들러: " + apiLogFormatter.describeHandler(request));
    lines.add("호출자: " + apiLogFormatter.describeActor());
    lines.add("클라이언트 IP: " + apiLogFormatter.describeClientIp(request));
    lines.add("쿼리 파라미터: " + apiLogFormatter.summarizeQueryParameters(request));
    lines.add("요청 본문: " + apiLogFormatter.summarizeRequestBody(request));
    lines.add("실패 지점: " + apiLogFormatter.inferFailureStage(request, status));
    lines.add("실패 사유: " + apiLogFormatter.inferFailureReason(request, status, responseBody));
    lines.add("응답 상태: " + status);
    lines.add("응답 본문: " + responseBody);
    lines.add("처리 시간(ms): " + elapsedMillis);
    return String.join(System.lineSeparator(), lines);
  }
}
