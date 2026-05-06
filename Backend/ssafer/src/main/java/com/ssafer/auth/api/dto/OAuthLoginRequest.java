package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OAuthLoginRequest(
    @NotNull
    @Schema(description = "OAuth 제공자", example = "GOOGLE")
    OAuthProvider provider,
    @NotBlank
    @Schema(description = "OAuth 인가 코드", example = "4/0AQSTgQ...")
    String authorizationCode,
    @NotBlank
    @Schema(description = "OAuth 리다이렉트 URI", example = "http://localhost:3000/oauth/callback")
    String redirectUri
) {
}
