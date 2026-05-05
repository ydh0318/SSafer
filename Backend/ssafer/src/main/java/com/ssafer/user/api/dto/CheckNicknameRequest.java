package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "닉네임 중복 확인 요청")
public class CheckNicknameRequest {

  @Schema(description = "중복 여부를 확인할 닉네임", example = "ssafer-user")
  @NotBlank(message = "닉네임은 필수입니다.")
  @Size(max = 100, message = "닉네임은 100자 이하여야 합니다.")
  private String nickname;

  public String getNickname() {
    return nickname;
  }

  public void setNickname(String nickname) {
    this.nickname = nickname;
  }
}
