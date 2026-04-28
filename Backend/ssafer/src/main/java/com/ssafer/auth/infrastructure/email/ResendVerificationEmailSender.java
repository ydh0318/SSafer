package com.ssafer.auth.infrastructure.email;

import com.ssafer.auth.domain.repository.VerificationEmailSender;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class ResendVerificationEmailSender implements VerificationEmailSender {

  private static final Logger log = LoggerFactory.getLogger(ResendVerificationEmailSender.class);
  private static final String RESEND_BASE_URL = "https://api.resend.com";
  private static final String USER_AGENT = "ssafer-backend/1.0";
  private static final String SUBJECT = "SSAFER 이메일 인증 코드";

  private final RestClient resendRestClient;
  private final String fromAddress;

  public ResendVerificationEmailSender(
      @Value("${RESEND_API_KEY:}") String resendApiKey,
      @Value("${EMAIL_FROM_ADDRESS:auth@mg.ssafer.co.kr}") String fromAddress
  ) {
    this.resendRestClient = RestClient.builder()
        .baseUrl(RESEND_BASE_URL)
        .defaultHeader("Authorization", "Bearer " + resendApiKey)
        .defaultHeader("User-Agent", USER_AGENT)
        .build();
    this.fromAddress = fromAddress;
  }

  @Override
  public void sendVerificationCode(String email, String code) {
    // Resend /emails 엔드포인트로 인증 메일을 전송한다.
    try {
      resendRestClient.post()
          .uri("/emails")
          .body(new ResendSendEmailRequest(
              fromAddress,
              List.of(email),
              SUBJECT,
              buildHtmlBody(code),
              buildTextBody(code)
          ))
          .retrieve()
          .body(ResendSendEmailResponse.class);
    } catch (RestClientResponseException ex) {
      // Resend가 내려준 실제 상태코드와 응답 본문을 남겨야 원인을 바로 확인할 수 있다.
      log.error(
          "Resend email delivery failed. status={}, from={}, to={}, response={}",
          ex.getStatusCode(),
          fromAddress,
          email,
          ex.getResponseBodyAsString()
      );
      throw ex;
    }
  }

  private String buildHtmlBody(String code) {
    return """
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>SSAFER 이메일 인증</h2>
          <p>아래 인증 코드를 입력해서 회원가입을 완료해 주세요.</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:4px">%s</p>
          <p>인증 코드는 5분 동안 유효합니다.</p>
        </div>
        """.formatted(code);
  }

  private String buildTextBody(String code) {
    return "SSAFER 이메일 인증 코드: %s (5분 이내 입력)".formatted(code);
  }

  private record ResendSendEmailRequest(
      String from,
      List<String> to,
      String subject,
      String html,
      String text
  ) {
  }

  private record ResendSendEmailResponse(
      String id
  ) {
  }
}
