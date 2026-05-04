package com.ssafer.auth.domain.repository;

public interface PasswordResetCodeEmailSender {

  void sendPasswordResetCode(String email, String code);
}
