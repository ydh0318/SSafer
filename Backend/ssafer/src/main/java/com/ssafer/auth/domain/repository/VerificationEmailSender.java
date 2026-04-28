package com.ssafer.auth.domain.repository;

public interface VerificationEmailSender {

  void sendVerificationCode(String email, String code);
}
