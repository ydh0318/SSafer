package com.ssafer.auth.infrastructure.email;

import com.ssafer.auth.domain.repository.PasswordResetCodeEmailSender;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class ResendPasswordResetCodeEmailSender implements PasswordResetCodeEmailSender {

  private static final Logger log = LoggerFactory.getLogger(ResendPasswordResetCodeEmailSender.class);
  private static final String RESEND_BASE_URL = "https://api.resend.com";
  private static final String USER_AGENT = "ssafer-backend/1.0";
  private static final String SUBJECT = "SSAFER password reset verification code";

  private final RestClient resendRestClient;
  private final String fromAddress;

  public ResendPasswordResetCodeEmailSender(
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
  public void sendPasswordResetCode(String email, String code) {
    // Resend 메일 API를 사용해 비밀번호 재설정용 인증코드를 보낸다.
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
      log.error(
          "Resend password reset email delivery failed. status={}, from={}, to={}, response={}",
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
          <h2>SSAFER Password Reset</h2>
          <p>Enter the verification code below to reset your password.</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:4px">%s</p>
          <p>This code is valid for 5 minutes.</p>
        </div>
        """.formatted(code);
  }

  private String buildTextBody(String code) {
    return "SSAFER password reset verification code: %s (valid for 5 minutes)".formatted(code);
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
