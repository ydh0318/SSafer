package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "이메일 중복 확인 요청")
public class CheckEmailRequest {

  @Schema(description = "중복 여부를 확인할 이메일", example = "test@example.com")
  @NotBlank(message = "이메일은 필수입니다.")
  @Email(message = "올바른 이메일 형식이어야 합니다.")
  @Size(max = 255, message = "이메일은 255자 이하여야 합니다.")
  private String email;

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }
}
