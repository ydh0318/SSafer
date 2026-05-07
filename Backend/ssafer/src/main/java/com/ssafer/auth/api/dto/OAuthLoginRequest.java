package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record OAuthLoginRequest(
    @NotNull
    @Schema(description = "OAuth provider", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "OAuth authorization code", example = "4/0AQSTgQ...")
    String authorizationCode,
    @Schema(description = "OAuth redirect URI", example = "http://localhost:5173/oauth/google/callback")
    String redirectUri,
    @Schema(description = "REJOIN_REQUIRED 응답 이후 재가입을 확정할 때만 true로 보냅니다.", example = "false")
    Boolean confirmRejoin,
    @Schema(description = "REJOIN_REQUIRED 응답에서 발급되며 계정 재활성화 확인에 사용하는 짧은 수명의 토큰입니다.")
    String rejoinToken
) {
}
