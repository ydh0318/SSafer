package com.ssafer.global.logging;

import com.ssafer.global.security.AgentPrincipal;
import com.ssafer.global.security.AuthenticatedActor;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class ApiLogFormatter {

  private static final int MAX_BODY_LENGTH = 2_000;
  // 로그 가독성을 해치지 않는 선에서 민감한 키만 마스킹한다.
  private static final Set<String> SENSITIVE_FIELD_NAMES = Set.of(
      "password",
      "token",
      "refreshToken",
      "accessToken",
      "authorization",
      "secret",
      "workerSecret",
      "verificationCode",
      "resetToken",
      "resetCode"
  );

  private final ObjectMapper objectMapper;

  public ApiLogFormatter(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String describeApi(HttpServletRequest request) {
    Object bestMatchingPattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
    String path = bestMatchingPattern instanceof String pattern ? pattern : request.getRequestURI();
    return request.getMethod() + " " + path;
  }

  public String describeHandler(HttpServletRequest request) {
    Object handler = request.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
    if (handler instanceof HandlerMethod handlerMethod) {
      return handlerMethod.getBeanType().getSimpleName() + "#" + handlerMethod.getMethod().getName();
    }
    return "매핑 정보 없음";
  }

  public String describeActor() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      return "미인증 사용자";
    }

    Object principal = authentication.getPrincipal();
    if (principal instanceof AuthenticatedActor actor) {
      if (actor.isMember()) {
        return "회원(userId=" + actor.userId() + ")";
      }
      return "게스트(ownerKeyHash=" + abbreviate(actor.guestOwnerKeyHash(), 8) + ")";
    }

    if (principal instanceof AgentPrincipal agentPrincipal) {
      return "에이전트(agentId=" + agentPrincipal.agentId() + ")";
    }

    if (principal instanceof String principalText && StringUtils.hasText(principalText)) {
      if ("anonymousUser".equalsIgnoreCase(principalText)) {
        return "미인증 사용자";
      }
      if ("worker".equalsIgnoreCase(principalText)) {
        return "워커 내부 호출";
      }
      return principalText;
    }

    return authentication.getName();
  }

  public String describeClientIp(HttpServletRequest request) {
    String forwardedFor = request.getHeader("X-Forwarded-For");
    if (StringUtils.hasText(forwardedFor)) {
      return forwardedFor.split(",")[0].trim();
    }

    String realIp = request.getHeader("X-Real-IP");
    if (StringUtils.hasText(realIp)) {
      return realIp.trim();
    }

    return StringUtils.hasText(request.getRemoteAddr()) ? request.getRemoteAddr() : "알 수 없음";
  }

  public String summarizeQueryParameters(HttpServletRequest request) {
    Map<String, String[]> parameterMap = request.getParameterMap();
    if (parameterMap.isEmpty()) {
      return "없음";
    }

    Map<String, Object> sanitized = new LinkedHashMap<>();
    for (Map.Entry<String, String[]> entry : parameterMap.entrySet()) {
      String key = entry.getKey();
      String[] values = entry.getValue();
      if (values == null || values.length == 0) {
        sanitized.put(key, "");
        continue;
      }

      if (values.length == 1) {
        sanitized.put(key, sanitizeScalar(key, values[0]));
        continue;
      }

      List<String> sanitizedValues = new ArrayList<>();
      for (String value : values) {
        sanitizedValues.add(sanitizeScalar(key, value));
      }
      sanitized.put(key, sanitizedValues);
    }

    return truncate(sanitized.toString(), MAX_BODY_LENGTH);
  }

  public String summarizeHeaders(HttpServletRequest request) {
    Map<String, String> headers = new LinkedHashMap<>();
    Enumeration<String> headerNames = request.getHeaderNames();
    while (headerNames != null && headerNames.hasMoreElements()) {
      String name = headerNames.nextElement();
      if ("authorization".equalsIgnoreCase(name)
          || "cookie".equalsIgnoreCase(name)
          || "x-worker-secret".equalsIgnoreCase(name)) {
        headers.put(name, maskSensitiveText(request.getHeader(name)));
        continue;
      }

      if ("user-agent".equalsIgnoreCase(name) || name.toLowerCase(Locale.ROOT).startsWith("x-")) {
        headers.put(name, truncate(request.getHeader(name), 200));
      }
    }

    return headers.isEmpty() ? "없음" : truncate(headers.toString(), 600);
  }

  public String summarizeRequestBody(ContentCachingRequestWrapper request) {
    return summarizeBody(
        request.getContentAsByteArray(),
        request.getContentType(),
        request.getCharacterEncoding(),
        // 요청 본문은 인증 코드 등 사용자가 직접 넣는 값이 많아 더 보수적으로 마스킹한다.
        true
    );
  }

  public String summarizeResponseBody(ContentCachingResponseWrapper response) {
    return summarizeBody(
        response.getContentAsByteArray(),
        response.getContentType(),
        response.getCharacterEncoding(),
        // 응답 에러 코드는 운영자가 그대로 읽어야 하므로 generic code 마스킹은 끈다.
        false
    );
  }

  public String inferFailureStage(HttpServletRequest request, int status) {
    String failureStage = ApiLogContext.getFailureStage(request);
    if (StringUtils.hasText(failureStage)) {
      return failureStage;
    }

    if (status == 401) {
      return "인증 검증";
    }
    if (status == 403) {
      return "권한 검증";
    }
    if (status >= 500) {
      return "서버 내부 처리";
    }
    if (status >= 400) {
      return "요청 검증";
    }
    return "-";
  }

  public String inferFailureReason(HttpServletRequest request, int status, String responseBody) {
    String failureReason = ApiLogContext.getFailureReason(request);
    if (StringUtils.hasText(failureReason)) {
      return failureReason;
    }

    String responseMessage = extractResponseMessage(responseBody);
    if (StringUtils.hasText(responseMessage)) {
      return responseMessage;
    }

    if (status == 401) {
      return "인증 정보가 없거나 토큰 검증에 실패했습니다.";
    }
    if (status == 403) {
      return "인증은 되었지만 요청한 자원에 접근할 권한이 없습니다.";
    }
    if (status >= 500) {
      return "서버 내부에서 처리 중 예외가 발생했습니다.";
    }
    if (status >= 400) {
      return "요청 형식 또는 입력값 검증에 실패했습니다.";
    }
    return "-";
  }

  private String summarizeBody(
      byte[] body,
      String contentType,
      String characterEncoding,
      boolean maskGenericCode
  ) {
    if (body == null || body.length == 0) {
      return "없음";
    }

    if (!isTextBasedContentType(contentType)) {
      // 파일 업로드/다운로드 본문은 로그 용량과 민감도 문제가 있어 본문 자체는 남기지 않는다.
      return "바이너리 또는 멀티파트 본문은 로그에서 생략했습니다.";
    }

    Charset charset = StringUtils.hasText(characterEncoding)
        ? Charset.forName(characterEncoding)
        : StandardCharsets.UTF_8;
    String raw = new String(body, charset);
    String sanitized = sanitizeStructuredText(raw, maskGenericCode);
    return truncate(sanitized, MAX_BODY_LENGTH);
  }

  private boolean isTextBasedContentType(String contentType) {
    if (!StringUtils.hasText(contentType)) {
      return true;
    }

    String normalized = contentType.toLowerCase(Locale.ROOT);
    return normalized.contains(MediaType.APPLICATION_JSON_VALUE)
        || normalized.contains(MediaType.APPLICATION_XML_VALUE)
        || normalized.contains(MediaType.TEXT_PLAIN_VALUE)
        || normalized.contains(MediaType.TEXT_HTML_VALUE)
        || normalized.contains(MediaType.APPLICATION_FORM_URLENCODED_VALUE)
        || normalized.contains("text/")
        || normalized.contains("+json")
        || normalized.contains("+xml");
  }

  private String sanitizeStructuredText(String raw, boolean maskGenericCode) {
    if (!StringUtils.hasText(raw)) {
      return "없음";
    }

    try {
      // JSON은 필드 단위로 마스킹하고, 그 외 텍스트는 원문을 짧게만 남긴다.
      JsonNode root = objectMapper.readTree(raw);
      JsonNode sanitized = sanitizeJsonNode(root, null, maskGenericCode);
      return objectMapper.writeValueAsString(sanitized);
    } catch (Exception ignored) {
      return raw;
    }
  }

  private JsonNode sanitizeJsonNode(JsonNode node, String fieldName, boolean maskGenericCode) {
    if (node == null || node.isNull()) {
      return node;
    }

    if (isSensitiveField(fieldName, maskGenericCode)) {
      return objectMapper.getNodeFactory().textNode(maskSensitiveText(node.asText()));
    }

    if (node.isObject()) {
      ObjectNode sanitized = objectMapper.createObjectNode();
      node.properties().forEach(entry ->
          sanitized.set(entry.getKey(), sanitizeJsonNode(entry.getValue(), entry.getKey(), maskGenericCode))
      );
      return sanitized;
    }

    if (node.isArray()) {
      ArrayNode sanitized = objectMapper.createArrayNode();
      for (JsonNode element : node) {
        sanitized.add(sanitizeJsonNode(element, fieldName, maskGenericCode));
      }
      return sanitized;
    }

    return node;
  }

  private String extractResponseMessage(String responseBody) {
    if (!StringUtils.hasText(responseBody) || "없음".equals(responseBody)) {
      return null;
    }

    try {
      JsonNode root = objectMapper.readTree(responseBody);
      if (root.hasNonNull("message")) {
        return root.get("message").asText();
      }
    } catch (Exception ignored) {
      return responseBody;
    }
    return responseBody;
  }

  private String sanitizeScalar(String key, String value) {
    if (isSensitiveField(key, true)) {
      return maskSensitiveText(value);
    }
    return truncate(value, 200);
  }

  private boolean isSensitiveField(String fieldName, boolean maskGenericCode) {
    if (!StringUtils.hasText(fieldName)) {
      return false;
    }

    String normalized = fieldName.toLowerCase(Locale.ROOT);
    // 요청의 code 필드는 대부분 인증 코드 의미라 기본적으로 가린다.
    if (maskGenericCode && "code".equals(normalized)) {
      return true;
    }
    return SENSITIVE_FIELD_NAMES.stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .anyMatch(normalized::contains);
  }

  private String maskSensitiveText(String value) {
    if (!StringUtils.hasText(value)) {
      return "***";
    }

    String trimmed = value.trim();
    if (trimmed.length() <= 4) {
      return "*".repeat(trimmed.length());
    }

    int prefixLength = Math.min(3, trimmed.length() / 2);
    int suffixLength = Math.min(2, Math.max(0, trimmed.length() - prefixLength - 1));
    String maskedBody = "*".repeat(Math.max(1, trimmed.length() - prefixLength - suffixLength));
    return trimmed.substring(0, prefixLength) + maskedBody + trimmed.substring(trimmed.length() - suffixLength);
  }

  private String abbreviate(String value, int maxLength) {
    if (!StringUtils.hasText(value)) {
      return "-";
    }
    return value.length() <= maxLength ? value : value.substring(0, maxLength) + "...";
  }

  private String truncate(String value, int maxLength) {
    if (value == null) {
      return "없음";
    }

    String normalized = value.replace("\r", "").replace("\n", " ");
    if (normalized.length() <= maxLength) {
      return normalized;
    }
    return normalized.substring(0, maxLength) + "...(생략)";
  }
}
