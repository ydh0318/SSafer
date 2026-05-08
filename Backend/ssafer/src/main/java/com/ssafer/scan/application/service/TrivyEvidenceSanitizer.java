package com.ssafer.scan.application.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class TrivyEvidenceSanitizer {

  private static final String MASK = "***MASKED***";
  private static final Pattern URL_CREDENTIAL_PATTERN = Pattern.compile(
      "(?<scheme>[a-z][a-z0-9+.-]*://)(?<user>[^:\\s/@]+):(?<password>[^@\\s]+)@",
      Pattern.CASE_INSENSITIVE
  );
  private static final Pattern AWS_KEY_PATTERN = Pattern.compile("AKIA[0-9A-Z]{16}");
  private static final Pattern PRIVATE_KEY_PATTERN = Pattern.compile(
      "-----BEGIN\\s(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\\s\\S]+?-----END[^\\n]*KEY-----",
      Pattern.MULTILINE
  );

  private TrivyEvidenceSanitizer() {
  }

  static String sanitizeEvidence(String value) {
    // Trivy evidence에 포함될 수 있는 민감 문자열을 비식별화한다.
    // URL 자격증명, AWS Access Key, Private Key 블록을 마스킹한다.
    if (value == null) {
      return "";
    }

    String sanitized = sanitizeUrlCredentials(value);
    sanitized = AWS_KEY_PATTERN.matcher(sanitized).replaceAll("AKIA****MASKED****");
    sanitized = PRIVATE_KEY_PATTERN.matcher(sanitized).replaceAll("[PRIVATE KEY REDACTED]");
    return sanitized;
  }

  static String sanitizeSecretMatch(String value) {
    // Trivy secret match 값은 원문을 보존하지 않고 고정 마스크로 치환한다.
    if (value == null || value.isBlank()) {
      return "";
    }
    return MASK;
  }

  private static String sanitizeUrlCredentials(String value) {
    Matcher matcher = URL_CREDENTIAL_PATTERN.matcher(value);
    StringBuffer buffer = new StringBuffer();
    while (matcher.find()) {
      String replacement = matcher.group("scheme") + matcher.group("user") + ":" + MASK + "@";
      matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(buffer);
    return buffer.toString();
  }
}
