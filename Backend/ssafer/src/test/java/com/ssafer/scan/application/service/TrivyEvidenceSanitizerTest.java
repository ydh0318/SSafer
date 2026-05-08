package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TrivyEvidenceSanitizerTest {

  @Test
  void sanitizeSecretMatchMasksNonBlankValue() {
    // Secret match는 값 보존 없이 고정 마스크로 치환되어야 한다.
    String sanitized = TrivyEvidenceSanitizer.sanitizeSecretMatch("AKIA1234567890ABCDEF");

    assertThat(sanitized).isEqualTo("***MASKED***");
  }

  @Test
  void sanitizeEvidenceMasksUrlCredentials() {
    // URL 자격증명(user:password@)의 password 영역이 마스킹되어야 한다.
    String sanitized = TrivyEvidenceSanitizer.sanitizeEvidence("postgres://admin:secret123@db.internal:5432/app");

    assertThat(sanitized).isEqualTo("postgres://admin:***MASKED***@db.internal:5432/app");
  }

  @Test
  void sanitizeEvidenceMasksAwsAccessKey() {
    // AWS Access Key 패턴은 직접 노출되지 않도록 치환되어야 한다.
    String sanitized = TrivyEvidenceSanitizer.sanitizeEvidence("token=AKIA1234567890ABCDEF");

    assertThat(sanitized).isEqualTo("token=AKIA****MASKED****");
  }

  @Test
  void sanitizeEvidenceMasksPrivateKeyBlock() {
    // Private Key 블록 전체가 안전한 문자열로 대체되어야 한다.
    String privateKey = """
        -----BEGIN PRIVATE KEY-----
        abcdefghijklmnopqrstuvwxyz
        -----END PRIVATE KEY-----
        """;

    String sanitized = TrivyEvidenceSanitizer.sanitizeEvidence(privateKey);

    assertThat(sanitized.trim()).isEqualTo("[PRIVATE KEY REDACTED]");
  }
}
